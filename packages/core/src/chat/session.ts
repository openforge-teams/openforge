import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { parseRefs } from '../context/assemble.js';
import type { AgentMode, ChatSession, Message } from '../types.js';

export class SessionManager {
  private sessions = new Map<string, ChatSession>();

  constructor(private readonly projectRoot: string) {}

  private sessionsDir(): string {
    return join(this.projectRoot, '.ai', 'sessions');
  }

  private sessionPath(id: string): string {
    return join(this.sessionsDir(), `${id}.json`);
  }

  create(title = 'New Session', mode: AgentMode = 'agent'): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: uuidv4(),
      title,
      messages: [],
      mode,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  async load(id: string): Promise<ChatSession | undefined> {
    if (this.sessions.has(id)) return this.sessions.get(id);

    try {
      const raw = await readFile(this.sessionPath(id), 'utf8');
      const session = JSON.parse(raw) as ChatSession;
      this.sessions.set(id, session);
      return session;
    } catch {
      return undefined;
    }
  }

  async save(session: ChatSession): Promise<void> {
    session.updatedAt = Date.now();
    this.sessions.set(session.id, session);
    await mkdir(this.sessionsDir(), { recursive: true });
    await writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8');
  }

  addMessage(session: ChatSession, message: Message): ChatSession {
    const updated: ChatSession = {
      ...session,
      messages: [...session.messages, message],
      updatedAt: Date.now(),
    };
    this.sessions.set(session.id, updated);
    return updated;
  }

  parseUserInput(text: string): {
    cleanText: string;
    refs: ReturnType<typeof parseRefs>['refs'];
  } {
    return parseRefs(text);
  }

  setMode(session: ChatSession, mode: AgentMode): ChatSession {
    const updated = { ...session, mode, updatedAt: Date.now() };
    this.sessions.set(session.id, updated);
    return updated;
  }

  clear(session: ChatSession): ChatSession {
    const updated = { ...session, messages: [], updatedAt: Date.now() };
    this.sessions.set(session.id, updated);
    return updated;
  }

  async list(): Promise<ChatSession[]> {
    const { readdir } = await import('node:fs/promises');
    try {
      const files = await readdir(this.sessionsDir());
      const sessions: ChatSession[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.replace(/\.json$/, '');
        const session = await this.load(id);
        if (session) sessions.push(session);
      }
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  exportSession(session: ChatSession): string {
    return JSON.stringify(session, null, 2);
  }
}
