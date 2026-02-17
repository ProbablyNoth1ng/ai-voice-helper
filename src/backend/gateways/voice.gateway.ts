import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AIService } from '../ai-integration/ai.service'; 
import { HotkeyService } from '../hotkey-listener/hotkey.service';
import { StorageServiceSimple } from '../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MessageBodyPayload {
  openaiKey?: string;
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
  maxHttpBufferSize: 15e6 
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private isProcessing = false;

  constructor(
    private readonly aiService: AIService, 
    private readonly hotkeyService: HotkeyService,
    private readonly storageService: StorageServiceSimple
  ) {}

  afterInit() {
    const transcriptionLanguage = this.storageService.get('transcriptionLanguage');
    const responseLanguage = this.storageService.get('responseLanguage');
    
    if (transcriptionLanguage) {
      this.aiService.updateTranscriptionLanguage(transcriptionLanguage);
      this.logger.log(`🌍 Loaded transcription language from storage: ${transcriptionLanguage}`);
    }
    
    if (responseLanguage) {
      this.aiService.updateResponseLanguage(responseLanguage);
      this.logger.log(`🌍 Loaded response language from storage: ${responseLanguage}`);
    }
    
    this.logger.log('✅ Gateway initialized with saved settings');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    this.hotkeyService.onHotkey(() => {
      this.logger.debug('Hotkey pressed (backend)');
      this.server.emit('hotkey-pressed');
    });
 
    const currentConfig = {
      transcriptionLanguage: this.storageService.get('transcriptionLanguage') || 'en',
      responseLanguage: this.storageService.get('responseLanguage') || 'en',
      model: this.storageService.get('model') || 'gpt-4o-mini',
      opacity: this.storageService.get('opacity') || 0.85,
      alwaysOnTop: this.storageService.get('alwaysOnTop') ?? true,
      hotkey: this.storageService.get('hotkey') || 'Ctrl+Shift+Q'
    };
    
    client.emit('current-config', currentConfig);
    client.emit('state-change', { state: 'idle' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
 
  @SubscribeMessage('process-audio')
  async handleProcessAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { audio: string }
  ) {
    if (this.isProcessing) {
      this.logger.warn('Already processing');
      return;
    }

    this.isProcessing = true;

    try {
      const currentResponseLang = this.storageService.get('responseLanguage') || 'en';
      this.logger.log(`🎤 Received audio data (Response language: ${currentResponseLang})`);
      client.emit('state-change', { state: 'processing' });

      const audioBuffer = Buffer.from(payload.audio, 'base64');
      this.logger.log(`📦 Audio size: ${audioBuffer.length} bytes`);

      const tempPath = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);
      fs.writeFileSync(tempPath, audioBuffer);
      this.logger.log(`💾 Saved to: ${tempPath}`);

      const transcript = await this.aiService.transcribeAudio(tempPath);
      this.logger.log(`📝 Transcript: ${transcript}`);

      fs.unlinkSync(tempPath);

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('No speech detected');
      }

      client.emit('transcript', { text: transcript });

      const response = await this.aiService.getCompletion(transcript);
      this.logger.log(`🤖 AI Response (${currentResponseLang}): ${response.substring(0, 100)}...`);

      this.storageService.addToHistory(transcript, response);

      client.emit('ai-response', { text: response, language: currentResponseLang });
      client.emit('state-change', { state: 'idle' });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Error: ${errorMessage}`);
      client.emit('error', { message: errorMessage });
      client.emit('state-change', { state: 'idle' });
    } finally {
      this.isProcessing = false;
    }
  }

  @SubscribeMessage('process-transcript')
  async handleProcessTranscript(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { text: string }
  ) {
    if (this.isProcessing) return;
    if (!payload.text?.trim()) {
      client.emit('error', { message: 'Empty transcript' });
      return;
    }

    this.isProcessing = true;

    try {
      const currentResponseLang = this.storageService.get('responseLanguage') || 'en';
      this.logger.log(`📝 Processing transcript (Response language: ${currentResponseLang})`);
      client.emit('state-change', { state: 'processing' });

      const response = await this.aiService.getCompletion(payload.text);
      this.storageService.addToHistory(payload.text, response);

      client.emit('ai-response', { text: response, language: currentResponseLang });
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
      if (payload.openaiKey) {
        this.aiService.updateApiKey(payload.openaiKey);
        this.storageService.set('apiKey', payload.openaiKey);
      }
      if (payload.model) {
        this.aiService.updateModel(payload.model);
        this.storageService.set('model', payload.model);
      }
      if (payload.transcriptionLanguage) {
        this.aiService.updateTranscriptionLanguage(payload.transcriptionLanguage);
        this.storageService.set('transcriptionLanguage', payload.transcriptionLanguage);
        this.logger.log(`🌍 Transcription language updated to: ${payload.transcriptionLanguage}`);
      }
      if (payload.responseLanguage) {
        this.aiService.updateResponseLanguage(payload.responseLanguage);
        this.storageService.set('responseLanguage', payload.responseLanguage);
        this.logger.log(`🌍 Response language updated to: ${payload.responseLanguage}`);
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
      client.emit('config-updated', { success: true });
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
    const config = {
      transcriptionLanguage: this.storageService.get('transcriptionLanguage') || 'en',
      responseLanguage: this.storageService.get('responseLanguage') || 'en',
      model: this.storageService.get('model') || 'gpt-4o-mini',
      opacity: this.storageService.get('opacity') || 0.85,
      alwaysOnTop: this.storageService.get('alwaysOnTop') ?? true,
      hotkey: this.storageService.get('hotkey') || 'Ctrl+Shift+Q'
    };
    client.emit('current-config', config);
  }
}