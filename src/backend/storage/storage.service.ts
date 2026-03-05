import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface AppStorage {
  apiKey?: string;
  model?: string;
  hotkey?: string;
  transcriptionLanguage?: string;
  responseLanguage?: string;
  opacity?: number;
  alwaysOnTop?: boolean;
  aiProvider?: string;
  aiModel?: string;
  openaiKey?: string;
  geminiKey?: string;
  claudeKey?: string;
  conversationHistory?: Array<{
    timestamp: number;
    userMessage: string;
    aiResponse: string;
  }>;
}

@Injectable()
export class StorageServiceSimple {
  private readonly logger = new Logger(StorageServiceSimple.name);
  private readonly storePath: string;
  private data: AppStorage;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    this.storePath = path.join(homeDir, '.ai-assistant-config.json');
    this.loadData();
  }

  private loadData(): void {
    try {
      this.data = this.getDefaults();
      this.saveData();
    
    } catch (error) {
      this.logger.error('Failed to load storage', error);
      this.data = this.getDefaults();
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save storage', error);
    }
  }

  private getDefaults(): AppStorage {
    return {
      model: 'gpt-4o-mini',
      hotkey: 'Ctrl+Shift+Q',
      transcriptionLanguage: 'en',
      responseLanguage: 'en',
      opacity: 0.9,
      alwaysOnTop: true,
      aiProvider: 'openai',      
      aiModel: 'gpt-4o-mini',      
      conversationHistory: []
    };
  }

  get<K extends keyof AppStorage>(key: K): AppStorage[K] | undefined {
    return this.data[key];
  }

  set<K extends keyof AppStorage>(key: K, value: AppStorage[K]): void {
    this.data[key] = value;
    this.saveData();
  }

  addToHistory(userMessage: string, aiResponse: string): void {
    const history = this.get('conversationHistory') || [];
    history.push({
      timestamp: Date.now(),
      userMessage,
      aiResponse
    });

    if (history.length > 100) {
      history.shift();
    }

    this.set('conversationHistory', history);
  }

  getHistory(limit = 10) {
    const history = this.get('conversationHistory') || [];
    return history.slice(-limit);
  }

  clearHistory(): void {
    this.set('conversationHistory', []);
  }
}