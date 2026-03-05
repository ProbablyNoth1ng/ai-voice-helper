import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

type AIProvider = 'openai' | 'gemini' | 'claude';

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
  private transcriptionLanguage: string = 'en';
  private responseLanguage: string = 'en';

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    this.openaiModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.geminiModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';
    this.claudeModel = this.configService.get<string>('CLAUDE_MODEL') || 'claude-3-5-sonnet-20241022';

    if (!openaiKey) {
      this.logger.warn('OpenAI API key not configured');
    }

    this.openaiClient = new OpenAI({ apiKey: openaiKey });
    
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.logger.log('✅ Gemini AI initialized');
    }

    const claudeKey = this.configService.get<string>('CLAUDE_API_KEY');
    if (claudeKey) {
      this.claudeClient = new Anthropic({ apiKey: claudeKey });
      this.logger.log('✅ Claude AI initialized');
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

  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      this.logger.log(`🎤 Transcribing audio with Whisper (lang: ${this.transcriptionLanguage})...`);

      const transcription = await this.openaiClient.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: this.transcriptionLanguage, 
        response_format: 'text'
      });

      this.logger.log(`✅ Transcription complete: ${transcription}`);
      return transcription;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Whisper API error:', errorMessage);
      throw new Error('Failed to transcribe audio: ' + errorMessage);
    }
  }

  async getCompletion(prompt: string): Promise<string> {
    try {
      this.logger.log(`🤖 Getting completion from ${this.currentProvider}...`);

      switch (this.currentProvider) {
        case 'openai':
          return await this.getOpenAICompletion(prompt);
        case 'gemini':
          return await this.getGeminiCompletion(prompt);
        case 'claude':
          return await this.getClaudeCompletion(prompt);
        default:
          throw new Error(`Unknown AI provider: ${this.currentProvider}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI API error (${this.currentProvider}):`, errorMessage);
      throw new Error(`Failed to get AI response from ${this.currentProvider}: ` + errorMessage);
    }
  }

  private async getOpenAICompletion(prompt: string): Promise<string> {
    const completion = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages: [
        {
          role: 'system',
          content: process.env.SYSTEM_PROMPT || 'You are a helpful AI interview assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'No response generated.';
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
      }
    });

    const systemPrompt = process.env.SYSTEM_PROMPT || 'You are a helpful AI interview assistant.';
    const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

    const result = await model.generateContent(fullPrompt);
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
      system: process.env.SYSTEM_PROMPT || 'You are a helpful AI interview assistant.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text || 'No response generated.';
    }
    
    return 'No response generated.';
  }

  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  getAvailableProviders(): { provider: AIProvider; available: boolean }[] {
    return [
      { provider: 'openai', available: !!this.openaiClient },
      { provider: 'gemini', available: !!this.geminiClient },
      { provider: 'claude', available: !!this.claudeClient }
    ];
  }
}