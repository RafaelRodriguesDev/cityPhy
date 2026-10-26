import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface FileStats {
  bytes: number;
  updatedAt: string;
}

/** Size and date of a file, or null when it does not exist or cannot be read. */
export function fileStats(path: string): FileStats | null {
  try {
    const s = statSync(path);
    if (!s.isFile()) return null;
    return { bytes: s.size, updatedAt: s.mtime.toISOString() };
  } catch {
    return null;
  }
}

export function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Names inside a folder (empty when the folder is missing). */
export function listDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export { join };
