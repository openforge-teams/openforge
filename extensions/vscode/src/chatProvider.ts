import * as vscode from 'vscode';
import { runAgentTask } from './coreBridge.js';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openforge.chatView';

  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg: { type: string; text?: string; mode?: string }) => {
      if (msg.type === 'send' && msg.text) {
        await this.handleSend(msg.text, (msg.mode as 'agent' | 'plan' | 'ask') ?? 'agent');
      }
    });
  }

  private async handleSend(
    text: string,
    mode: 'agent' | 'plan' | 'ask',
  ): Promise<void> {
    this.postMessage({ type: 'status', text: 'Thinking…' });

    try {
      await runAgentTask(text, mode, (line) => {
        this.postMessage({ type: 'stream', text: line });
      });
      this.postMessage({ type: 'status', text: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.postMessage({ type: 'error', text: message });
    }
  }

  private postMessage(msg: unknown): void {
    this.view?.webview.postMessage(msg);
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 8px;
      gap: 8px;
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .msg {
      padding: 8px 10px;
      border-radius: 6px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .user { background: var(--vscode-input-background); align-self: flex-end; max-width: 90%; }
    .assistant { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); }
    .error { color: var(--vscode-errorForeground); }
    .status { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 0.9em; }
    #input-row { display: flex; gap: 6px; }
    #mode { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 4px 6px; }
    #input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: inherit;
    }
    #send {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
    }
    #send:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <div id="messages"></div>
  <div id="input-row">
    <select id="mode">
      <option value="agent">Agent</option>
      <option value="plan">Plan</option>
      <option value="ask">Ask</option>
    </select>
    <input id="input" type="text" placeholder="Ask OpenForge…" />
    <button id="send">Send</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const messages = document.getElementById('messages');
    const input = document.getElementById('input');
    const mode = document.getElementById('mode');
    const send = document.getElementById('send');
    let statusEl = null;

    function addMsg(text, cls) {
      const el = document.createElement('div');
      el.className = 'msg ' + cls;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
      return el;
    }

    function doSend() {
      const text = input.value.trim();
      if (!text) return;
      addMsg(text, 'user');
      input.value = '';
      vscode.postMessage({ type: 'send', text, mode: mode.value });
    }

    send.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend();
    });

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'stream') {
        const last = messages.querySelector('.assistant:last-child');
        if (last && !last.dataset.done) {
          last.textContent += '\\n' + msg.text;
        } else {
          const el = addMsg(msg.text, 'assistant');
        }
        messages.scrollTop = messages.scrollHeight;
      } else if (msg.type === 'status') {
        if (statusEl) statusEl.remove();
        if (msg.text) {
          statusEl = addMsg(msg.text, 'status');
        }
      } else if (msg.type === 'error') {
        if (statusEl) statusEl.remove();
        addMsg(msg.text, 'error');
      }
    });
  </script>
</body>
</html>`;
  }
}
