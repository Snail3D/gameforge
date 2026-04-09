import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GameMetadata {
  name: string;
  slug: string;
  description: string;
  genre: string;
  tags: string[];
  created: string;
  buildStats: {
    stepsCompleted: number;
    stepsSkipped: number;
    totalCycles: number;
    buildTimeMinutes: number;
    loopsCaught: number;
  };
  status: 'building' | 'playable' | 'polished';
  builderModel: string;
  plannerModel: string;
}

export function writeGameJson(gameDir: string, metadata: GameMetadata): void {
  writeFileSync(join(gameDir, 'game.json'), JSON.stringify(metadata, null, 2));
}
