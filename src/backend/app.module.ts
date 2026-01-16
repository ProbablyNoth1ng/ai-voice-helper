import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceGateway } from './gateways/voice.gateway';
import { AIService } from './ai-integration/ai.service';
import { HotkeyService } from './hotkey-listener/hotkey.service';
import { StorageServiceSimple } from './storage/storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    })
  ],
  controllers: [],
  providers: [
    VoiceGateway,
    AIService,
    HotkeyService,
    StorageServiceSimple
  ]
})
export class AppModule {}