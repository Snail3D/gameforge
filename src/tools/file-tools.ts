import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export class FileTools {
  private readonly gameDir: string;

  constructor(gameDir: string) {
    this.gameDir = resolve(gameDir);
  }

  private safePath(relPath: string): string {
    const abs = resolve(join(this.gameDir, relPath));
    if (!abs.startsWith(this.gameDir + '/') && abs !== this.gameDir) {
      throw new Error(`Path traversal denied: ${relPath}`);
    }
    return abs;
  }

  readFile(relPath: string): string {
    const abs = this.safePath(relPath);
    return readFileSync(abs, 'utf-8');
  }

  writeFile(relPath: string, content: string): void {
    const abs = this.safePath(relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
  }

  listFiles(dir?: string): string[] {
    const baseAbs = dir ? this.safePath(dir) : this.gameDir;
    const results: string[] = [];

    const walk = (current: string): void => {
      const entries = readdirSync(current);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(current, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          results.push(relative(this.gameDir, fullPath));
        }
      }
    };

    walk(baseAbs);
    return results.sort();
  }

  searchCode(query: string): SearchResult[] {
    const searchableExts = new Set(['.js', '.html', '.css', '.json']);
    const files = this.listFiles().filter(f => {
      const dot = f.lastIndexOf('.');
      return dot !== -1 && searchableExts.has(f.slice(dot));
    });

    const results: SearchResult[] = [];
    for (const relFile of files) {
      const abs = join(this.gameDir, relFile);
      const lines = readFileSync(abs, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(query)) {
          results.push({
            file: relFile,
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    }
    return results;
  }
}
