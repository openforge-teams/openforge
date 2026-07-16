import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Checkpoint, FileChange } from '../types.js';

export class CheckpointManager {
  private readonly baseDir: string;

  constructor(private readonly projectRoot: string) {
    this.baseDir = join(projectRoot, '.ai', 'checkpoints');
  }

  async create(label: string, changes: FileChange[]): Promise<Checkpoint> {
    const id = uuidv4();
    const checkpointDir = join(this.baseDir, id);
    await mkdir(checkpointDir, { recursive: true });

    const snapshotChanges: FileChange[] = [];

    for (const change of changes) {
      const relPath = change.path;
      const snapshotPath = join(checkpointDir, relPath);
      await mkdir(dirname(snapshotPath), { recursive: true });

      if (change.operation === 'delete') {
        const source = join(this.projectRoot, relPath);
        try {
          const content = await readFile(source, 'utf8');
          await writeFile(snapshotPath, content, 'utf8');
          snapshotChanges.push({ ...change, before: content });
        } catch {
          snapshotChanges.push({ ...change });
        }
      } else if (change.before !== undefined) {
        await writeFile(snapshotPath, change.before, 'utf8');
        snapshotChanges.push({ ...change });
      } else {
        const source = join(this.projectRoot, relPath);
        try {
          const content = await readFile(source, 'utf8');
          await writeFile(snapshotPath, content, 'utf8');
          snapshotChanges.push({ ...change, before: content });
        } catch {
          snapshotChanges.push({ ...change });
        }
      }
    }

    const checkpoint: Checkpoint = {
      id,
      label,
      createdAt: Date.now(),
      files: snapshotChanges,
    };

    await writeFile(join(checkpointDir, 'meta.json'), JSON.stringify(checkpoint, null, 2), 'utf8');
    return checkpoint;
  }

  async restore(id: string): Promise<Checkpoint> {
    const checkpointDir = join(this.baseDir, id);
    const metaPath = join(checkpointDir, 'meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as Checkpoint;

    for (const change of meta.files) {
      const target = join(this.projectRoot, change.path);
      const snapshot = join(checkpointDir, change.path);

      if (change.operation === 'delete') {
        try {
          const content = await readFile(snapshot, 'utf8');
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, content, 'utf8');
        } catch {
          // snapshot missing
        }
      } else if (change.before !== undefined) {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, change.before, 'utf8');
      }
    }

    return meta;
  }

  async list(): Promise<Checkpoint[]> {
    const { readdir } = await import('node:fs/promises');
    try {
      const dirs = await readdir(this.baseDir);
      const checkpoints: Checkpoint[] = [];

      for (const dir of dirs) {
        try {
          const meta = JSON.parse(
            await readFile(join(this.baseDir, dir, 'meta.json'), 'utf8'),
          ) as Checkpoint;
          checkpoints.push(meta);
        } catch {
          // skip invalid
        }
      }

      return checkpoints.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  async remove(id: string): Promise<void> {
    await rm(join(this.baseDir, id), { recursive: true, force: true });
  }
}

export async function snapshotFile(projectRoot: string, relPath: string): Promise<string | undefined> {
  try {
    return await readFile(join(projectRoot, relPath), 'utf8');
  } catch {
    return undefined;
  }
}

export async function copyToCheckpoint(
  projectRoot: string,
  checkpointId: string,
  relPath: string,
): Promise<void> {
  const source = join(projectRoot, relPath);
  const dest = join(projectRoot, '.ai', 'checkpoints', checkpointId, relPath);
  await mkdir(dirname(dest), { recursive: true });
  await cp(source, dest);
}
