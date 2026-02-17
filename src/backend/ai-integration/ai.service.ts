import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { en_prompt, ru_prompt, uk_prompt } from 'src/shared/constants/prompts';
import { en_instruction, ru_instruction, uk_instruction } from 'src/shared/constants/instructions';
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private client: OpenAI;
  private model: string;
  private transcriptionLanguage: string = 'en';
  private responseLanguage: string = 'en'; 

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

  updateTranscriptionLanguage(language: string): void {
    this.transcriptionLanguage = language;
    this.logger.log(`Transcription language updated to: ${language}`);
  }

  updateResponseLanguage(language: string): void {
    this.responseLanguage = language;
    this.logger.log(`Response language updated to: ${language}`);
  }

  private getSystemPrompt(): string {
    const prompts = {
      en: en_prompt,
      ru: ru_prompt,
      uk: uk_prompt
    };

    return prompts[this.responseLanguage as keyof typeof prompts] || prompts.en;
  }

  private getLanguageInstruction(): string {
    const instructions = {
      en:  en_instruction,
      ru:  ru_instruction,
      uk:  uk_instruction,
    };
    return instructions[this.responseLanguage as keyof typeof instructions] || instructions.en;
  }

  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      this.logger.log(`🎤 Transcribing audio with Whisper (language: ${this.transcriptionLanguage})...`);
      
      const languageMap = {
        'en': 'en',
        'ru': 'ru',
        'uk': 'uk'
      };

      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: languageMap[this.transcriptionLanguage as keyof typeof languageMap] || 'en',
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
      this.logger.log(`🤖 Generating response in ${this.responseLanguage}...`);
      this.logger.log(`📝 Original prompt: ${prompt}`);
      
      const enhancedPrompt = `${this.getLanguageInstruction()}\n\nQuestion: ${prompt}`;
      
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content || 'No response generated.';
      this.logger.log(`✅ Generated response (${this.responseLanguage}): ${response.substring(0, 100)}...`);
      
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('OpenAI API error:', errorMessage);
      throw new Error('Failed to get AI response: ' + errorMessage);
    }
  }
}