import db from '../../database';

export function isLoggingEnabled(): boolean {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('logging_enabled') as { value: string } | undefined;
  return row ? row.value === '1' : true;
}

export function setLoggingEnabled(enabled: boolean): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('logging_enabled', enabled ? '1' : '0');
}
