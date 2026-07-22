import * as vscode from 'vscode';
import { PromptChainTreeDataProvider } from './views/prompts-tree';
import { publishCommand } from './commands/publish';
import { listPromptsCommand } from './commands/list';
import { diffPromptCommand } from './commands/diff';

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new PromptChainTreeDataProvider();
  vscode.window.registerTreeDataProvider('promptchain.explorer', treeProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('promptchain.publish', () =>
      publishCommand(context)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('promptchain.listPrompts', () =>
      listPromptsCommand(context)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('promptchain.diffPrompt', (uri) =>
      diffPromptCommand(context, uri)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('promptchain.refreshExplorer', () =>
      treeProvider.refresh()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('promptchain.forkPrompt', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter the prompt CID to fork',
        placeHolder: 'Qm...',
      });
      if (input) {
        vscode.window.showInformationMessage(`Forking prompt: ${input}`);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('promptchain.setLicense', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'License name',
        placeHolder: 'MIT, Apache-2.0, CC-BY-4.0, etc.',
      });
      if (!name) return;
      const commercial = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        { placeHolder: 'Allow commercial use?' }
      );
      const attribution = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        { placeHolder: 'Require attribution?' }
      );
      vscode.window.showInformationMessage(
        `License ${name} (commercial: ${commercial}, attribution: ${attribution})`
      );
    })
  );

  vscode.window.registerTreeDataProvider('promptchain.explorer', treeProvider);
}

export function deactivate() {}
