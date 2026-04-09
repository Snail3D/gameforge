import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface PublishResult {
  success: boolean;
  commit: string;
  filesChanged: number;
  error?: string;
}

export function publishToGithub(
  gameDir: string,
  gameName: string,
  stepTitle: string
): PublishResult {
  try {
    const repoDir = findRepoRoot(gameDir);
    if (!repoDir) {
      return { success: false, commit: '', filesChanged: 0, error: 'Not in a git repository' };
    }

    // Stage all changes
    execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });

    // Check for changes
    const status = execSync('git status --porcelain', { cwd: repoDir, encoding: 'utf-8' });
    const filesChanged = status.trim().split('\n').filter(l => l.trim()).length;
    if (filesChanged === 0) {
      return { success: true, commit: 'no-changes', filesChanged: 0 };
    }

    // Commit (message is hardcoded format, no user input)
    const message = `${gameName}: ${stepTitle}`;
    execSync(`git commit -m "${message}"`, { cwd: repoDir, stdio: 'pipe' });

    // Get commit SHA
    const commit = execSync('git rev-parse --short HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim();

    // Push
    execSync('git push', { cwd: repoDir, stdio: 'pipe' });

    return { success: true, commit, filesChanged };
  } catch (err: any) {
    return { success: false, commit: '', filesChanged: 0, error: err.message };
  }
}

function findRepoRoot(dir: string): string | null {
  let current = resolve(dir);
  while (current !== '/') {
    if (existsSync(join(current, '.git'))) return current;
    current = resolve(current, '..');
  }
  return null;
}
