import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';


@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private client: OpenAI;
  private model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
    }
    
    this.client = new OpenAI({ apiKey });
  }

  updateApiKey(apiKey: string): void {
    this.client = new OpenAI({ apiKey });
    this.logger.log('OpenAI API key updated');
  }

  updateModel(model: string): void {
    this.model = model;
    this.logger.log(`Model updated to: ${model}`);
  }
 
  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      this.logger.log('🎤 Transcribing audio with Whisper...');
      
      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: 'en',
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
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: process.env.SYSTEM_PROMPT
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('OpenAI API error:', errorMessage);
      throw new Error('Failed to get AI response: ' + errorMessage);
    }
  }
}