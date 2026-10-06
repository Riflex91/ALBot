/** Editor hints only. Classic CODE scripts must not import this file at runtime. */
export {};
type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
interface LocalMessage { from: string; topic: string; data: JSONValue; }
interface LocalResult { queued: string[]; }
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
interface HeadlessLogger {
  level: LogLevel;
  trace(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fatal(...args: unknown[]): void;
  child(bindings: Record<string, unknown>): HeadlessLogger;
  isLevelEnabled(level: LogLevel): boolean;
}
interface HeadlessAPI {
  writeTestReport?: (content: string) => string;
  readonly version: string;
  readonly apiVersion: 1;
  readonly capabilities: Readonly<{testReports?:true; localMessages:true; localCM:true; sharedStorage:true; caracal:true; graphics:false; dashboard:boolean; minimap:boolean}>;
  send(to: string | string[], topic: string, data: JSONValue): Promise<LocalResult>;
  broadcast(topic: string, data: JSONValue): Promise<LocalResult>;
  onMessage(handler: (event: LocalMessage) => void | Promise<void>): () => boolean;
}
interface CaracalCompatibilityAPI {
  /** Resolves when accepted, not when target CODE is ready. Defaults inherit caller. */
  deploy(characterName?: string | null, realm?: string | null, scriptPath?: string | null, gameVersion?: number | string | null): Promise<true>;
  shutdown(characterName?: string | null): Promise<true>;
  readonly siblings: string[];
  load_scripts(paths: string[]): Promise<void>;
  map_enabled(): boolean;
  runner: Window;
  log: HeadlessLogger;
}
declare global {
  interface Window {
    /** Absent in the official browser; always feature-detect. */
    headless?: HeadlessAPI;
    caracAL?: CaracalCompatibilityAPI;
  }
}
