import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AIService } from '../ai-integration/ai.service';
import { HotkeyService } from '../hotkey-listener/hotkey.service';
import { StorageServiceSimple } from '../storage/storage.service';

interface MessageBodyPayload {
  openaiKey?: string;
  geminiKey?: string;
  claudeKey?: string;
  aiProvider?: string;
  aiModel?: string;
  model?: string;
  hotkey?: string;
  opacity?: number;
  alwaysOnTop?: boolean;
  transcriptionLanguage?: string;
  responseLanguage?: string;
}

@WebSocketGateway(3001, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 30e6,
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private isProcessing = false;

  constructor(
    private readonly aiService: AIService,
    private readonly hotkeyService: HotkeyService,
    private readonly storageService: StorageServiceSimple,
  ) {}

  afterInit() {
    const aiProvider = this.storageService.get('aiProvider');
    const aiModel = this.storageService.get('aiModel');

    if (aiProvider) {
      this.aiService.updateProvider(aiProvider as 'openai' | 'gemini' | 'claude');
      this.logger.log(`Restored AI provider from storage: ${aiProvider}`);
    }

    if (aiModel && aiProvider) {
      this.aiService.updateModels({ [aiProvider]: aiModel });
      this.logger.log(`Restored AI model from storage: ${aiModel}`);
    }

    const transcriptionLanguage = this.storageService.get('transcriptionLanguage');
    const responseLanguage = this.storageService.get('responseLanguage');

    if (transcriptionLanguage) {
      this.aiService.updateTranscriptionLanguage(transcriptionLanguage);
      this.logger.log(`Loaded transcription language from storage: ${transcriptionLanguage}`);
    }

    if (responseLanguage) {
      this.aiService.updateResponseLanguage(responseLanguage);
      this.logger.log(`Loaded response language from storage: ${responseLanguage}`);
    }

    this.logger.log('Gateway initialized with saved settings');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    this.hotkeyService.onHotkey(() => {
      this.logger.debug('Hotkey pressed (backend)');
      this.server.emit('hotkey-pressed');
    });

    client.emit('current-config', this.getCurrentConfig());
    client.emit('state-change', { state: 'idle' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('process-audio')
  async handleProcessAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { audio: unknown },
  ) {
    await this.runAudioRequest(client, payload?.audio, async (transcript, currentResponseLang, startedAt) => {
      client.emit('ai-response-start', { language: currentResponseLang });

      let firstChunkLogged = false;
      const response = await this.aiService.streamCompletion(transcript, {
        onChunk: (chunk) => {
          if (!firstChunkLogged) {
            firstChunkLogged = true;
            this.logger.log(`First answer chunk in ${Date.now() - startedAt}ms`);
          }

          client.emit('ai-response-chunk', { text: chunk, language: currentResponseLang });
        },
      });

      this.storageService.addToHistory(transcript, response);
      client.emit('ai-response-done', { text: response, language: currentResponseLang });
    });
  }

  @SubscribeMessage('process-coding-task')
  async handleProcessCodingTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { audio: unknown; screenshot: string },
  ) {
    if (!payload?.screenshot) {
      client.emit('error', { message: 'Missing screenshot' });
      return;
    }

    await this.runAudioRequest(
      client,
      payload.audio,
      async (transcript, currentResponseLang, startedAt) => {
        client.emit('ai-response-start', { language: currentResponseLang });

        let firstChunkLogged = false;
        const response = await this.aiService.streamCodingTaskCompletion(
          transcript,
          payload.screenshot,
          {
            onChunk: (chunk) => {
              if (!firstChunkLogged) {
                firstChunkLogged = true;
                this.logger.log(`First coding answer chunk in ${Date.now() - startedAt}ms`);
              }

              client.emit('ai-response-chunk', { text: chunk, language: currentResponseLang });
            },
          },
        );

        this.storageService.addToHistory(`[Coding task]\n${transcript}`, response);
        client.emit('ai-response-done', { text: response, language: currentResponseLang });
      },
      'coding',
    );
  }

  @SubscribeMessage('process-transcript')
  async handleProcessTranscript(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { text: string },
  ) {
    if (this.isProcessing) {
      return;
    }

    if (!payload.text?.trim()) {
      client.emit('error', { message: 'Empty transcript' });
      return;
    }

    this.isProcessing = true;
    const startedAt = Date.now();

    try {
      const currentResponseLang = this.storageService.get('responseLanguage') || 'en';
      client.emit('state-change', { state: 'processing' });
      client.emit('transcript', { text: payload.text });
      client.emit('ai-response-start', { language: currentResponseLang });

      let firstChunkLogged = false;
      const response = await this.aiService.streamCompletion(payload.text, {
        onChunk: (chunk) => {
          if (!firstChunkLogged) {
            firstChunkLogged = true;
            this.logger.log(`First text answer chunk in ${Date.now() - startedAt}ms`);
          }

          client.emit('ai-response-chunk', { text: chunk, language: currentResponseLang });
        },
      });

      this.storageService.addToHistory(payload.text, response);
      client.emit('ai-response-done', { text: response, language: currentResponseLang });
      client.emit('state-change', { state: 'idle' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      client.emit('error', { message: errorMessage });
      client.emit('state-change', { state: 'idle' });
    } finally {
      this.isProcessing = false;
    }
  }

  @SubscribeMessage('stop-listening')
  handleStopListening(@ConnectedSocket() client: Socket) {
    client.emit('state-change', { state: 'idle' });
    this.isProcessing = false;
  }

  @SubscribeMessage('update-config')
  handleUpdateConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageBodyPayload,
  ) {
    try {
      const previousProvider = this.storageService.get('aiProvider') || 'openai';
      const previousModel = this.storageService.get('aiModel') || 'gpt-4o-mini';
      let activeProvider = previousProvider;
      let activeModel = previousModel;
      let modelSettingsChanged = false;

      if (payload.aiProvider) {
        this.aiService.updateProvider(payload.aiProvider as 'openai' | 'gemini' | 'claude');
        this.storageService.set('aiProvider', payload.aiProvider);
        activeProvider = payload.aiProvider;
        modelSettingsChanged = modelSettingsChanged || payload.aiProvider !== previousProvider;
        this.logger.log(`AI Provider switched to: ${payload.aiProvider}`);
      }

      if (payload.aiModel) {
        const provider = payload.aiProvider ?? activeProvider;
        this.aiService.updateModels({ [provider]: payload.aiModel });
        this.storageService.set('aiModel', payload.aiModel);
        activeProvider = provider;
        activeModel = payload.aiModel;
        modelSettingsChanged = modelSettingsChanged || payload.aiModel !== previousModel;
        this.logger.log(`AI Model set to: ${payload.aiModel} (provider: ${provider})`);
      }

      if (payload.openaiKey || payload.geminiKey || payload.claudeKey) {
        this.aiService.updateApiKeys({
          openaiKey: payload.openaiKey,
          geminiKey: payload.geminiKey,
          claudeKey: payload.claudeKey,
        });

        if (payload.openaiKey) {
          this.storageService.set('openaiKey', payload.openaiKey);
        }

        if (payload.geminiKey) {
          this.storageService.set('geminiKey', payload.geminiKey);
        }

        if (payload.claudeKey) {
          this.storageService.set('claudeKey', payload.claudeKey);
        }
      }

      if (payload.model) {
        this.aiService.updateModels({ openai: payload.model });
        this.storageService.set('model', payload.model);
      }

      if (payload.transcriptionLanguage) {
        this.aiService.updateTranscriptionLanguage(payload.transcriptionLanguage);
        this.storageService.set('transcriptionLanguage', payload.transcriptionLanguage);
        this.logger.log(`Transcription language updated to: ${payload.transcriptionLanguage}`);
      }

      if (payload.responseLanguage) {
        this.aiService.updateResponseLanguage(payload.responseLanguage);
        this.storageService.set('responseLanguage', payload.responseLanguage);
        this.logger.log(`Response language updated to: ${payload.responseLanguage}`);
      }

      if (payload.hotkey) {
        this.hotkeyService.updateHotkey(payload.hotkey);
        this.storageService.set('hotkey', payload.hotkey);
      }

      if (payload.opacity !== undefined) {
        this.storageService.set('opacity', payload.opacity);
      }

      if (payload.alwaysOnTop !== undefined) {
        this.storageService.set('alwaysOnTop', payload.alwaysOnTop);
      }

      client.emit('config-updated', {
        success: true,
        activeProvider,
        activeModel,
      });

      if (modelSettingsChanged) {
        this.server.emit('model-switched', {
          provider: activeProvider,
          model: activeModel,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      client.emit('error', { message: errorMessage });
    }
  }

  @SubscribeMessage('get-history')
  handleGetHistory(@ConnectedSocket() client: Socket) {
    const history = this.storageService.getHistory(20);
    client.emit('history', { history });
  }

  @SubscribeMessage('get-config')
  handleGetConfig(@ConnectedSocket() client: Socket) {
    client.emit('current-config', this.getCurrentConfig());
  }

  private getCurrentConfig() {
    return {
      transcriptionLanguage: this.storageService.get('transcriptionLanguage') || 'en',
      responseLanguage: this.storageService.get('responseLanguage') || 'en',
      model: this.storageService.get('model') || 'gpt-4o-mini',
      opacity: this.storageService.get('opacity') || 0.9,
      alwaysOnTop: this.storageService.get('alwaysOnTop') ?? true,
      hotkey: this.storageService.get('hotkey') || 'Ctrl+Shift+Q',
      aiProvider: this.storageService.get('aiProvider') || 'openai',
      aiModel: this.storageService.get('aiModel') || 'gpt-4o-mini',
    };
  }

  private async runAudioRequest(
    client: Socket,
    rawAudio: unknown,
    handleResponse: (
      transcript: string,
      currentResponseLang: string,
      startedAt: number,
    ) => Promise<void>,
    mode: 'voice' | 'coding' = 'voice',
  ) {
    if (this.isProcessing) {
      this.logger.warn('Already processing');
      return;
    }

    this.isProcessing = true;
    const startedAt = Date.now();

    try {
      const currentResponseLang = this.storageService.get('responseLanguage') || 'en';
      const currentProvider = this.aiService.getCurrentProvider();
      client.emit('state-change', { state: 'processing' });

      const audioBuffer = this.decodeAudioPayload(rawAudio);
      this.logger.log(
        `${mode} request received (provider: ${currentProvider}, lang: ${currentResponseLang}, bytes: ${audioBuffer.length})`,
      );

      let firstTranscriptLogged = false;
      const transcript = await this.aiService.transcribeAudio(audioBuffer, (delta) => {
        if (!delta) {
          return;
        }

        if (!firstTranscriptLogged) {
          firstTranscriptLogged = true;
          this.logger.log(`First transcript delta in ${Date.now() - startedAt}ms`);
        }

        client.emit('transcript-chunk', { text: delta });
      });

      if (!transcript.trim()) {
        throw new Error('No speech detected');
      }

      client.emit('transcript', { text: transcript });
      this.logger.log(`Transcript ready in ${Date.now() - startedAt}ms`);

      await handleResponse(transcript, currentResponseLang, startedAt);
      client.emit('state-change', { state: 'idle' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`${mode} request failed: ${errorMessage}`);
      client.emit('error', { message: errorMessage });
      client.emit('state-change', { state: 'idle' });
    } finally {
      this.isProcessing = false;
    }
  }

  private decodeAudioPayload(payload: unknown): Buffer {
    if (!payload) {
      throw new Error('Missing audio payload');
    }

    if (Buffer.isBuffer(payload)) {
      return payload;
    }

    if (typeof payload === 'string') {
      return Buffer.from(payload, 'base64');
    }

    if (payload instanceof ArrayBuffer) {
      return Buffer.from(payload);
    }

    if (ArrayBuffer.isView(payload)) {
      return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'type' in payload &&
      'data' in payload &&
      (payload as { type?: string }).type === 'Buffer' &&
      Array.isArray((payload as { data?: unknown }).data)
    ) {
      return Buffer.from((payload as { data: number[] }).data);
    }

    throw new Error('Unsupported audio payload');
  }
}
