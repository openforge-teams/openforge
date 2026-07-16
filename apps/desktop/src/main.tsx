import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { useSettingsStore } from './stores/settingsStore';
import { seedMemoryWorkspace } from './host/browser';

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
}

seedMemoryWorkspace();

// Note: StrictMode double-mount races with xterm FitAddon; keep single mount for IDE shell.
createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
