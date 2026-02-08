/**
 * Minimal Node.js globals so TypeScript can type-check without resolving @types/node
 * (e.g. under Yarn PnP). Safe to remove if @types/node is installed and resolved.
 */
declare global {
  const Buffer: {
    from(data: string | ArrayBuffer | ArrayLike<number>, encoding?: string): Buffer;
    prototype: unknown;
    allocUnsafe(size: number): Buffer;
    alloc(size: number): Buffer;
    isBuffer(obj: unknown): obj is Buffer;
  };
  interface Buffer extends Uint8Array {
    toString(encoding?: string): string;
    equals(other: Buffer): boolean;
  }
  var console: {
    log(...args: unknown[]): void;
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
  };
}
export {};
