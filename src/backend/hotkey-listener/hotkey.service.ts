import { Injectable, Logger } from '@nestjs/common';
import { GlobalKeyboardListener } from 'node-global-key-listener';
import { ConfigService } from '@nestjs/config';

interface HotkeyConfig {
  ctrl: boolean;
  shift: boolean;
  key: string;
}

@Injectable()
export class HotkeyService {
  private readonly logger = new Logger(HotkeyService.name);
  private listener: GlobalKeyboardListener;
  private callback: (() => void) | null = null;
  private hotkeyConfig: HotkeyConfig = {
    ctrl: true,
    shift: true,
    key: 'SPACE'
  };

  constructor(private configService: ConfigService) {
    this.listener = new GlobalKeyboardListener();
    this.parseHotkeyFromEnv();
    this.setupListeners();
  }

  private parseHotkeyFromEnv(): void {
    const hotkey = this.configService.get('DEFAULT_HOTKEY') || 'Ctrl+Shift+Space';
    const parts = hotkey.split('+').map((p: string) => p.trim().toLowerCase());
    
    this.hotkeyConfig = {
      ctrl: parts.includes('ctrl'),
      shift: parts.includes('shift'),
      key: parts[parts.length - 1].toUpperCase()
    };

    this.logger.log(`Hotkey configured: ${JSON.stringify(this.hotkeyConfig)}`);
  }

  private setupListeners(): void {
    this.listener.addListener((e, down) => {
      if (e.state === 'DOWN' && e.name === this.hotkeyConfig.key) {
        const ctrlPressed = down['LEFT CTRL'] || down['RIGHT CTRL'];
        const shiftPressed = down['LEFT SHIFT'] || down['RIGHT SHIFT'];

        const matches = 
          (!this.hotkeyConfig.ctrl || ctrlPressed) &&
          (!this.hotkeyConfig.shift || shiftPressed);

        if (matches && this.callback) {
          this.callback();
        }
      }
    });
  }

  onHotkey(callback: () => void): void {
    this.callback = callback;
  }

  updateHotkey(hotkey: string): void {
    const parts = hotkey.split('+').map((p: string) => p.trim().toLowerCase());
    
    this.hotkeyConfig = {
      ctrl: parts.includes('ctrl'),
      shift: parts.includes('shift'),
      key: parts[parts.length - 1].toUpperCase()
    };

    this.logger.log(`Hotkey updated to: ${hotkey}`);
  }
}
