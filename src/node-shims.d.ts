declare module "node:fs/promises" {
  export function readFile(path: string, encoding: string): Promise<string>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function writeFile(path: string, data: string, encoding: string | { encoding?: string; flag?: string }): Promise<void>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function readdir(path: string): Promise<string[]>;
  export function access(path: string): Promise<void>;
}
declare module "node:test" {
  const test: (name: string, fn: () => void | Promise<void>) => void;
  export default test;
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
}
declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown): void;
    deepEqual(actual: unknown, expected: unknown): void;
    match(actual: string, expected: RegExp): void;
    rejects(fn: () => Promise<unknown>, expected?: RegExp | { name?: string }): Promise<void>;
    notEqual(actual: unknown, expected: unknown): void;
    throws(fn: () => unknown, expected?: RegExp): void;
    ok(value: unknown, message?: string): void;
  };
  export default assert;
}
declare module "node:crypto" {
  export function createHash(algorithm: string): { update(value: string): { digest(encoding: string): string } };
  export function randomUUID(): string;
}
declare module "node:os" { export function tmpdir(): string; }
declare const process: { exitCode?: number; pid?: number; execPath: string; argv: string[]; env: Record<string, string | undefined> };
declare module "node:child_process" {
  export function spawnSync(command: string, args?: string[], options?: { encoding?: string; env?: Record<string, string | undefined> }): { status: number | null; stdout: string; stderr: string };
}
declare module "geotiff" {
  export function fromUrl(url: string, options?: Record<string, unknown>): Promise<any>;
}
