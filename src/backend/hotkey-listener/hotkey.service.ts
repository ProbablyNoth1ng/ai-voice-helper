import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
interface HotkeyConfig {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

@Injectable()
export class HotkeyService {
  private readonly logger = new Logger(HotkeyService.name);
  private callback: (() => void) | null = null;
  private hotkeyConfig: HotkeyConfig = {
    ctrl: true,
    shift: true,
    alt: true,
    key: 'Q'
  };

  constructor(private configService: ConfigService) {
    this.parseHotkeyFromEnv();
    this.logger.log('⌨️ HotkeyService initialized');
    this.logger.log(`   Configured hotkey: ${this.getHotkeyString()}`);
    this.logger.log('   Note: Actual hotkey listening handled by Electron globalShortcut');
  }

  private parseHotkeyFromEnv(): void {
    const hotkey = this.configService.get('DEFAULT_HOTKEY') || 'Ctrl+Shift+Q';
    const parts = hotkey.split('+').map((p: string) => p.trim().toLowerCase());

    this.hotkeyConfig = {
      ctrl: parts.includes('ctrl') || parts.includes('commandorcontrol'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt') || parts.includes('option'),
      key: parts[parts.length - 1].toUpperCase()
    };

    this.logger.log(`Hotkey parsed from env: ${JSON.stringify(this.hotkeyConfig)}`);
  }

  onHotkey(callback: () => void): void {
    this.callback = callback;
    this.logger.log('Hotkey callback registered');
  }

  triggerHotkey(): void {
    if (this.callback) {
      this.logger.debug('Hotkey triggered');
      this.callback();
    } else {
      this.logger.warn('Hotkey triggered but no callback registered');
    }
  }

  updateHotkey(hotkey: string): void {
    const parts = hotkey.split('+').map((p: string) => p.trim().toLowerCase());

    this.hotkeyConfig = {
      ctrl: parts.includes('ctrl') || parts.includes('commandorcontrol'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt') || parts.includes('option'),
      key: parts[parts.length - 1].toUpperCase()
    };

    this.logger.log(`Hotkey updated to: ${hotkey}`);
    this.logger.log('Note: Electron app needs to restart to apply new hotkey');
  }

  getHotkeyString(): string {
    const parts: string[] = [];
    if (this.hotkeyConfig.ctrl) parts.push('Ctrl');
    if (this.hotkeyConfig.shift) parts.push('Shift');
    if (this.hotkeyConfig.alt) parts.push('Alt');
    parts.push(this.hotkeyConfig.key);
    return parts.join('+');
  }

  getHotkeyConfig(): HotkeyConfig {
    return { ...this.hotkeyConfig };
  }
}
