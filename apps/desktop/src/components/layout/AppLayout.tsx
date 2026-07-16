import { useState } from 'react';
import { ActivityBar, type ActivityId } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { MonacoEditorPanel } from '@/components/editor/MonacoEditor';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { StatusBar } from './StatusBar';

interface Props {
  onOpenSettings: () => void;
}

export function AppLayout({ onOpenSettings }: Props) {
  const [activity, setActivity] = useState<ActivityId>('explorer');

  return (
    <div className="app-layout">
      <ActivityBar
        active={activity}
        onChange={setActivity}
        onOpenSettings={onOpenSettings}
      />
      <Sidebar activity={activity} />
      <main className="main-area">
        <div className="editor-area">
          <EditorTabs />
          <MonacoEditorPanel />
        </div>
        <TerminalPanel />
      </main>
      <ChatPanel />
      <StatusBar />
      <style>{`
        .app-layout {
          display: grid;
          grid-template-columns: var(--activity-width) var(--sidebar-width) 1fr var(--chat-width);
          grid-template-rows: 1fr var(--status-height);
          height: 100vh;
          overflow: hidden;
        }
        .main-area {
          grid-row: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .editor-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }
        .app-layout > :nth-child(1) { grid-column: 1; grid-row: 1 / 3; }
        .app-layout > :nth-child(2) { grid-column: 2; grid-row: 1; }
        .app-layout > :nth-child(3) { grid-column: 3; grid-row: 1; }
        .app-layout > :nth-child(4) { grid-column: 4; grid-row: 1; }
        .app-layout > :nth-child(5) { grid-column: 2 / 5; grid-row: 2; }
      `}</style>
    </div>
  );
}
