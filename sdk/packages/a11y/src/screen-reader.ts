export interface AriaLabel {
  label: string;
  description?: string;
  role?: string;
  live?: 'polite' | 'assertive' | 'off';
}

export interface AccessibleAnnouncement {
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export class ScreenReaderHelper {
  private announcements: AccessibleAnnouncement[] = [];

  announce(announcement: AccessibleAnnouncement): void {
    this.announcements.push(announcement);
    if (this.announcements.length > 100) {
      this.announcements.shift();
    }
  }

  getAnnouncements(): AccessibleAnnouncement[] {
    return [...this.announcements];
  }

  clearAnnouncements(): void {
    this.announcements = [];
  }

  formatStatus(
    label: string,
    status: 'success' | 'error' | 'pending' | 'info',
  ): AriaLabel {
    const statusMap: Record<string, string> = {
      success: `✓ ${label} completed successfully`,
      error: `✗ ${label} failed`,
      pending: `⏳ ${label} in progress`,
      info: `ℹ ${label}`,
    };
    return {
      label: statusMap[status] || label,
      role: 'status',
      live: status === 'error' ? 'assertive' : 'polite',
    };
  }

  formatList<T>(items: T[], formatter: (item: T, index: number) => string): string {
    if (items.length === 0) return 'No items.';
    return items
      .map((item, i) => `${i + 1}. ${formatter(item, i)}`)
      .join('\n');
  }

  formatMetrics(metrics: Record<string, string | number>): string {
    return Object.entries(metrics)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}: ${value}`)
      .join('. ');
  }
}
