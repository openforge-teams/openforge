export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FileStat {
  path: string;
  size: number;
  mtime: number;
}

export interface HostFS {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDir(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
  getProjectRoot(): string | null;
  openFolder(): Promise<string | null>;
  watchProject?(path: string, onChange: (path: string) => void): () => void;
}

export const TAURI_COMMANDS = {
  readFile: 'read_file',
  writeFile: 'write_file',
  listDir: 'list_dir',
  runCommand: 'run_command',
  watchProject: 'watch_project',
  getHomeConfig: 'get_home_config',
} as const;
