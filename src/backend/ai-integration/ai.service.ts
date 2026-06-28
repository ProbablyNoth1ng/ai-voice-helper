import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI, { toFile } from 'openai';
import type { TranscriptionStreamEvent } from 'openai/resources/audio/transcriptions';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

type AIProvider = 'openai' | 'gemini' | 'claude';

interface ImagePayload {
  mimeType: string;
  data: string;
  dataUrl: string;
}

interface StreamHandlers {
  onChunk: (chunk: string) => void;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a live coding interview assistant. First paragraph must be only the direct answer to the user's question, as short as possible. If the question asks for output, give the exact output first. After that, give a brief explanation using markdown when it improves clarity. Prefer short section titles, numbered lists for sequences, bullets for grouped facts, and fenced code blocks only for actual code. Avoid long walls of plain text. When an image is provided, read the visible code/text carefully before answering. Do not say you cannot see the code if code is visible.";

const CODING_TASK_PROMPT =
  'Read the screenshot carefully and treat it as the primary source of truth. Use the spoken clarification only as supporting context. If code or text is visible in the screenshot, use it directly and do not say that you cannot see the code. Answer the user question in the first paragraph only. For output questions, the first paragraph must be the exact output only. After that, give a brief explanation in markdown with short section titles, numbered lists for order, bullets for grouped facts, and fenced code blocks only when actual code helps.';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openaiClient: OpenAI;
  private geminiClient: GoogleGenerativeAI | null = null;
  private claudeClient: Anthropic | null = null;

  private currentProvider: AIProvider = 'openai';
  private openaiModel: string;
  private geminiModel: string;
  private claudeModel: string;
  private transcriptionModel: string;
  private transcriptionLanguage = 'en';
  private responseLanguage = 'en';
  private visionDetail: 'low' | 'high' | 'auto';

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    this.openaiModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.geminiModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';
    this.claudeModel = this.configService.get<string>('CLAUDE_MODEL') || 'claude-3-5-sonnet-20241022';
    this.transcriptionModel =
      this.configService.get<string>('OPENAI_TRANSCRIPTION_MODEL') || 'gpt-4o-mini-transcribe';
    this.visionDetail =
      (this.configService.get<string>('OPENAI_VISION_DETAIL') as 'low' | 'high' | 'auto') || 'high';

    if (!openaiKey) {
      this.logger.warn('OpenAI API key not configured');
    }

    this.openaiClient = new OpenAI({ apiKey: openaiKey });

    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.logger.log('Gemini AI initialized');
    }

    const claudeKey = this.configService.get<string>('CLAUDE_API_KEY');
    if (claudeKey) {
      this.claudeClient = new Anthropic({ apiKey: claudeKey });
      this.logger.log('Claude AI initialized');
    }
  }

  updateApiKeys(keys: { openaiKey?: string; geminiKey?: string; claudeKey?: string }): void {
    if (keys.openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: keys.openaiKey });
      this.logger.log('OpenAI API key updated');
    }

    if (keys.geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(keys.geminiKey);
      this.logger.log('Gemini API key updated');
    }

    if (keys.claudeKey) {
      this.claudeClient = new Anthropic({ apiKey: keys.claudeKey });
      this.logger.log('Claude API key updated');
    }
  }

  updateProvider(provider: AIProvider): void {
    this.currentProvider = provider;
    this.logger.log(`AI Provider switched to: ${provider}`);
  }

  updateModels(models: { openai?: string; gemini?: string; claude?: string }): void {
    if (models.openai) {
      this.openaiModel = models.openai;
      this.logger.log(`OpenAI model updated to: ${models.openai}`);
    }

    if (models.gemini) {
      this.geminiModel = models.gemini;
      this.logger.log(`Gemini model updated to: ${models.gemini}`);
    }

    if (models.claude) {
      this.claudeModel = models.claude;
      this.logger.log(`Claude model updated to: ${models.claude}`);
    }
  }

  updateTranscriptionLanguage(language: string): void {
    this.transcriptionLanguage = language;
    this.logger.log(`Transcription language updated to: ${language}`);
  }

  updateResponseLanguage(language: string): void {
    this.responseLanguage = language;
    this.logger.log(`Response language updated to: ${language}`);
  }

  async transcribeAudio(audioBuffer: Buffer, onDelta?: (delta: string) => void): Promise<string> {
    try {
      this.logger.log(
        `Transcribing audio with ${this.transcriptionModel} (lang: ${this.transcriptionLanguage})...`,
      );

      const audioFile = await toFile(audioBuffer, 'input.webm', { type: 'audio/webm' });

      if (this.supportsStreamingTranscription()) {
        const stream = await this.openaiClient.audio.transcriptions.create({
          file: audioFile,
          model: this.transcriptionModel as 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe' | 'gpt-4o-transcribe-diarize',
          language: this.transcriptionLanguage,
          stream: true,
        });

        let finalText = '';
        for await (const event of stream) {
          this.handleTranscriptionEvent(event, onDelta, (text) => {
            finalText = text;
          });
        }

        this.logger.log(`Transcription complete: ${finalText}`);
        return finalText;
      }

      const transcription = await this.openaiClient.audio.transcriptions.create({
        file: audioFile,
        model: this.transcriptionModel as 'whisper-1',
        language: this.transcriptionLanguage,
        response_format: 'text',
      });

      this.logger.log(`Transcription complete: ${transcription}`);
      return transcription;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Transcription API error:', errorMessage);
      throw new Error('Failed to transcribe audio: ' + errorMessage);
    }
  }

  async getCompletion(prompt: string): Promise<string> {
    try {
      this.logger.log(`Getting completion from ${this.currentProvider}...`);

      switch (this.currentProvider) {
        case 'openai':
          return this.getOpenAICompletion(prompt);
        case 'gemini':
          return this.getGeminiCompletion(prompt);
        case 'claude':
          return this.getClaudeCompletion(prompt);
        default:
          throw new Error(`Unknown AI provider: ${this.currentProvider}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI API error (${this.currentProvider}):`, errorMessage);
      throw new Error(`Failed to get AI response from ${this.currentProvider}: ` + errorMessage);
    }
  }

  async streamCompletion(prompt: string, handlers: StreamHandlers): Promise<string> {
    switch (this.currentProvider) {
      case 'openai':
        return this.streamOpenAICompletion(prompt, handlers);
      case 'gemini':
      case 'claude': {
        const fullText = await this.getCompletion(prompt);
        this.emitBufferedChunks(fullText, handlers.onChunk);
        return fullText;
      }
      default:
        throw new Error(`Unknown AI provider: ${this.currentProvider}`);
    }
  }

  async getCodingTaskCompletion(transcript: string, screenshot: string): Promise<string> {
    try {
      this.logger.log(`Getting coding task completion from ${this.currentProvider}...`);

      const image = this.parseImagePayload(screenshot);
      const prompt = this.buildCodingTaskPrompt(transcript);

      switch (this.currentProvider) {
        case 'openai':
          return this.getOpenAIVisionCompletion(prompt, image);
        case 'gemini':
          return this.getGeminiVisionCompletion(prompt, image);
        case 'claude':
          return this.getClaudeVisionCompletion(prompt, image);
        default:
          throw new Error(`Unknown AI provider: ${this.currentProvider}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Coding task AI API error (${this.currentProvider}):`, errorMessage);
      throw new Error(`Failed to get coding task response from ${this.currentProvider}: ` + errorMessage);
    }
  }

  async streamCodingTaskCompletion(
    transcript: string,
    screenshot: string,
    handlers: StreamHandlers,
  ): Promise<string> {
    if (this.currentProvider !== 'openai') {
      const fullText = await this.getCodingTaskCompletion(transcript, screenshot);
      this.emitBufferedChunks(fullText, handlers.onChunk);
      return fullText;
    }

    const image = this.parseImagePayload(screenshot);
    const prompt = this.buildCodingTaskPrompt(transcript);
    return this.streamOpenAIVisionCompletion(prompt, image, handlers);
  }

  private async getOpenAICompletion(prompt: string): Promise<string> {
    const completion = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages: [
        {
          role: 'system',
          content: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'No response generated.';
  }

  private async streamOpenAICompletion(prompt: string, handlers: StreamHandlers): Promise<string> {
    const stream = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages: [
        {
          role: 'system',
          content: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
    });

    return this.collectOpenAIStream(stream, handlers);
  }

  private async getOpenAIVisionCompletion(prompt: string, image: ImagePayload): Promise<string> {
    const completion = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages: [
        {
          role: 'system',
          content: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: image.dataUrl,
                detail: this.visionDetail,
              },
            },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.4,
    });

    return completion.choices[0]?.message?.content || 'No response generated.';
  }

  private async streamOpenAIVisionCompletion(
    prompt: string,
    image: ImagePayload,
    handlers: StreamHandlers,
  ): Promise<string> {
    const stream = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages: [
        {
          role: 'system',
          content: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: image.dataUrl,
                detail: this.visionDetail,
              },
            },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.4,
      stream: true,
    });

    return this.collectOpenAIStream(stream, handlers);
  }

  private async collectOpenAIStream(
    stream: AsyncIterable<ChatCompletionChunk>,
    handlers: StreamHandlers,
  ): Promise<string> {
    const chunker = new WordChunkAccumulator(handlers.onChunk);
    let fullText = '';

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content;
      if (!delta) {
        continue;
      }

      fullText += delta;
      chunker.push(delta);
    }

    chunker.flush();
    return fullText.trim();
  }

  private async getGeminiCompletion(prompt: string): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini API key not configured');
    }

    const model = this.geminiClient.getGenerativeModel({
      model: this.geminiModel,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    const systemPrompt = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    return response.text() || 'No response generated.';
  }

  private async getGeminiVisionCompletion(prompt: string, image: ImagePayload): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini API key not configured');
    }

    const model = this.geminiClient.getGenerativeModel({
      model: this.geminiModel,
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.4,
      },
    });

    const systemPrompt = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    const result = await (model as any).generateContent([
      { text: `${systemPrompt}\n\n${prompt}` },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      },
    ]);

    const response = result.response;
    return response.text() || 'No response generated.';
  }

  private async getClaudeCompletion(prompt: string): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude API key not configured');
    }

    const message = await this.claudeClient.messages.create({
      model: this.claudeModel,
      max_tokens: 500,
      temperature: 0.7,
      system: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text || 'No response generated.';
    }

    return 'No response generated.';
  }

  private async getClaudeVisionCompletion(prompt: string, image: ImagePayload): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude API key not configured');
    }

    const message = await this.claudeClient.messages.create({
      model: this.claudeModel,
      max_tokens: 1200,
      temperature: 0.4,
      system: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mimeType,
                data: image.data,
              },
            },
          ] as any,
        },
      ],
    });

    const textParts = message.content
      .filter((content) => content.type === 'text')
      .map((content) => (content.type === 'text' ? content.text : ''));

    return textParts.join('\n').trim() || 'No response generated.';
  }

  private buildCodingTaskPrompt(transcript: string): string {
    return [
      CODING_TASK_PROMPT,
      `Answer language: ${this.responseLanguage}.`,
      '',
      'Visible screenshot content is more important than vague spoken wording.',
      '',
      'Spoken clarification transcript:',
      transcript,
    ].join('\n');
  }

  private parseImagePayload(screenshot: string): ImagePayload {
    const match = screenshot.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (match) {
      return {
        mimeType: match[1],
        data: match[2],
        dataUrl: screenshot,
      };
    }

    return {
      mimeType: 'image/png',
      data: screenshot,
      dataUrl: `data:image/png;base64,${screenshot}`,
    };
  }

  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  getAvailableProviders(): { provider: AIProvider; available: boolean }[] {
    return [
      { provider: 'openai', available: !!this.openaiClient },
      { provider: 'gemini', available: !!this.geminiClient },
      { provider: 'claude', available: !!this.claudeClient },
    ];
  }

  private supportsStreamingTranscription(): boolean {
    return this.transcriptionModel !== 'whisper-1';
  }

  private handleTranscriptionEvent(
    event: TranscriptionStreamEvent,
    onDelta: ((delta: string) => void) | undefined,
    onDone: (text: string) => void,
  ): void {
    if (event.type === 'transcript.text.delta' && event.delta) {
      onDelta?.(event.delta);
      return;
    }

    if (event.type === 'transcript.text.done') {
      onDone(event.text);
    }
  }

  private emitBufferedChunks(text: string, emitChunk: (chunk: string) => void): void {
    const chunker = new WordChunkAccumulator(emitChunk);
    chunker.push(text);
    chunker.flush();
  }
}

class WordChunkAccumulator {
  private readonly minWords = 10;
  private readonly maxWords = 20;
  private pendingText = '';

  constructor(private readonly emitChunk: (chunk: string) => void) {}

  push(text: string): void {
    this.pendingText += text;
    this.emitAvailableChunks(false);
  }

  flush(): void {
    this.emitAvailableChunks(true);
  }

  private emitAvailableChunks(flushRemainder: boolean): void {
    while (true) {
      const nextChunk = this.takeNextChunk(flushRemainder);
      if (!nextChunk) {
        return;
      }

      this.emitChunk(nextChunk);
    }
  }

  private takeNextChunk(flushRemainder: boolean): string | null {
    const tokens = Array.from(this.pendingText.matchAll(/\S+\s*/g));
    if (tokens.length === 0) {
      return null;
    }

    if (!flushRemainder && tokens.length < this.minWords) {
      return null;
    }

    let boundaryIndex = -1;
    const maxIndex = Math.min(tokens.length, this.maxWords) - 1;

    for (let index = this.minWords - 1; index <= maxIndex; index += 1) {
      if (/[.!?:;]\s*$/.test(tokens[index][0])) {
        boundaryIndex = index;
        break;
      }
    }

    if (boundaryIndex === -1) {
      if (!flushRemainder && tokens.length <= this.maxWords) {
        return null;
      }

      boundaryIndex = maxIndex;
    }

    const selectedTokens = tokens.slice(0, boundaryIndex + 1);
    const chunkLength = selectedTokens.reduce((total, token) => total + token[0].length, 0);
    const chunk = this.pendingText.slice(0, chunkLength);
    this.pendingText = this.pendingText.slice(chunkLength);
    return chunk;
  }
}
