import { LogEntry } from '../types';

type LogListener = (logs: LogEntry[]) => void;

class AppLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs: number = 200;

  constructor() {
    this.info('VoiceFlow Studio Logger initialized');
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Console output
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }

    // Notify listeners
    this.notify();

    // Forward to desktop backend to write to app.log on disk if available
    if (typeof window !== 'undefined' && (window as any).pywebview?.api?.write_log) {
      try {
        (window as any).pywebview.api.write_log(level, `[${entry.timestamp}] ${message} ${details ? JSON.stringify(details) : ''}`);
      } catch (e) {
        // ignore
      }
    }
  }

  public info(message: string, details?: any) {
    this.addLog('info', message, details);
  }

  public warn(message: string, details?: any) {
    this.addLog('warn', message, details);
  }

  public error(message: string, details?: any) {
    this.addLog('error', message, details);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.logs];
    this.listeners.forEach((listener) => listener(copy));
  }
}

export const Logger = new AppLogger();
