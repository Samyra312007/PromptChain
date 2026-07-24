export interface KeyCombo {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface Shortcut {
  id: string;
  label: string;
  combo: KeyCombo;
  handler: () => void | Promise<void>;
  category: string;
}

export type ShortcutMap = Map<string, Shortcut>;

export class KeyboardShortcuts {
  private shortcuts: ShortcutMap = new Map();
  private registered = false;

  register(shortcut: Shortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  registerMany(shortcuts: Shortcut[]): void {
    for (const s of shortcuts) {
      this.shortcuts.set(s.id, s);
    }
  }

  unregister(id: string): boolean {
    return this.shortcuts.delete(id);
  }

  get(id: string): Shortcut | undefined {
    return this.shortcuts.get(id);
  }

  getAll(): Shortcut[] {
    return [...this.shortcuts.values()];
  }

  getByCategory(category: string): Shortcut[] {
    return this.getAll().filter((s) => s.category === category);
  }

  formatShortcut(combo: KeyCombo): string {
    const parts: string[] = [];
    if (combo.ctrl) parts.push('Ctrl');
    if (combo.alt) parts.push('Alt');
    if (combo.shift) parts.push('Shift');
    if (combo.meta) parts.push('Meta');
    parts.push(combo.key.toUpperCase());
    return parts.join('+');
  }

  formatHelp(): string {
    const categories = new Set(this.getAll().map((s) => s.category));
    const lines: string[] = ['Keyboard Shortcuts', '================='];
    for (const cat of categories) {
      lines.push(`\n${cat}:`);
      const catShortcuts = this.getByCategory(cat);
      for (const s of catShortcuts) {
        lines.push(`  ${this.formatShortcut(s.combo).padEnd(20)} ${s.label}`);
      }
    }
    return lines.join('\n');
  }
}
