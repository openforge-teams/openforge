import * as vscode from 'vscode';
import { ChatViewProvider } from './chatProvider.js';
import { runAgentTask, runInlineEdit } from './coreBridge.js';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  const chatProvider = new ChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider),
  );

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(layers) OpenForge';
  statusBarItem.tooltip = 'OpenForge AI Assistant';
  statusBarItem.command = 'openforge.openChat';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('openforge.openChat', async () => {
      await vscode.commands.executeCommand('openforge.chatView.focus');
    }),

    vscode.commands.registerCommand('openforge.inlineEdit', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const instruction = await vscode.window.showInputBox({
        prompt: 'Describe the edit for the selected code',
        placeHolder: 'e.g. Add error handling',
      });
      if (!instruction) return;

      statusBarItem.text = '$(loading~spin) OpenForge';
      try {
        const edit = await runInlineEdit(editor.document, editor.selection, instruction);
        if (!edit) {
          vscode.window.showInformationMessage('No edit suggested');
          return;
        }

        const applied = await editor.edit((builder) => {
          if (editor.selection.isEmpty) {
            const pos = editor.selection.active;
            builder.insert(pos, edit);
          } else {
            builder.replace(editor.selection, edit);
          }
        });

        if (applied) {
          vscode.window.showInformationMessage('Inline edit applied');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Inline edit failed: ${msg}`);
      } finally {
        statusBarItem.text = '$(layers) OpenForge';
      }
    }),

    vscode.commands.registerCommand('openforge.runAgent', async () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.selection;
      const selectedText = selection && !selection.isEmpty
        ? editor!.document.getText(selection)
        : '';

      const task = await vscode.window.showInputBox({
        prompt: 'Agent task',
        placeHolder: 'What should the agent do?',
        value: selectedText ? `Work on this selection:\n${selectedText}` : undefined,
      });
      if (!task) return;

      statusBarItem.text = '$(loading~spin) OpenForge';

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'OpenForge Agent',
          cancellable: false,
        },
        async () => {
          try {
            const result = await runAgentTask(task, 'agent');
            const channel = vscode.window.createOutputChannel('OpenForge');
            channel.appendLine(result);
            channel.show(true);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Agent failed: ${msg}`);
          } finally {
            statusBarItem.text = '$(layers) OpenForge';
          }
        },
      );
    }),

    vscode.commands.registerCommand('openforge.settings', async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:openforge.openforge-vscode',
      );
    }),
  );
}

export function deactivate(): void {
  statusBarItem?.dispose();
}
