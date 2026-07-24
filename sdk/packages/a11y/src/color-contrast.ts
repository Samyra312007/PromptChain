export type ColorScheme = 'light' | 'dark' | 'high-contrast-light' | 'high-contrast-dark';
export type ContrastLevel = 'normal' | 'high';

export interface ThemeConfig {
  scheme: ColorScheme;
  contrast: ContrastLevel;
  ansiColors: boolean;
}

const NO_COLOR_ENV = 'NO_COLOR';
const FORCE_COLOR_ENV = 'FORCE_COLOR';

export class ColorContrast {
  private config: ThemeConfig;

  constructor(config: Partial<ThemeConfig> = {}) {
    this.config = {
      scheme: config.scheme ?? this.detectColorScheme(),
      contrast: config.contrast ?? 'normal',
      ansiColors: config.ansiColors ?? ColorContrast.detectAnsiSupport(),
    };
  }

  get scheme(): ColorScheme {
    return this.config.scheme;
  }

  get contrast(): ContrastLevel {
    return this.config.contrast;
  }

  get ansiColors(): boolean {
    return this.config.ansiColors;
  }

  setScheme(scheme: ColorScheme): void {
    this.config.scheme = scheme;
  }

  setContrast(contrast: ContrastLevel): void {
    this.config.contrast = contrast;
  }

  isHighContrast(): boolean {
    return this.config.contrast === 'high' ||
      this.config.scheme === 'high-contrast-light' ||
      this.config.scheme === 'high-contrast-dark';
  }

  getLabel(label: string): string {
    if (this.isHighContrast()) {
      return `[${label.toUpperCase()}]`;
    }
    return label;
  }

  private detectColorScheme(): ColorScheme {
    if (process.env.COLORFGBG) {
      const bg = process.env.COLORFGBG.split(';').pop();
      if (bg === '0') return 'dark';
    }
    return 'light';
  }

  static detectAnsiSupport(): boolean {
    if (process.env[NO_COLOR_ENV] !== undefined && process.env[NO_COLOR_ENV] !== '') {
      return false;
    }
    if (process.env[FORCE_COLOR_ENV] !== undefined && process.env[FORCE_COLOR_ENV] !== '0') {
      return true;
    }
    if (process.env.TERM === 'dumb') return false;
    if (!process.stdout.isTTY) return false;
    return true;
  }
}
