/**
 * Node/extension host globals so the linter recognizes built-ins
 * when @types/node is not yet resolved.
 */
declare const console: Console;

declare module "fs" {
    export interface Stats {
        isDirectory(): boolean;
        mtime: Date;
    }
    export function existsSync(p: string): boolean;
    export function readdirSync(p: string): string[];
    export function statSync(p: string): Stats;
    export function readFileSync(p: string, encoding: string): string;
}

declare module "path" {
    export function join(...parts: string[]): string;
    export function dirname(p: string): string;
    export function basename(p: string, ext?: string): string;
    export const sep: string;
}
