import * as vscode from 'vscode';

export async function publishCommand(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor. Open a file to publish.');
    return;
  }

  const document = editor.document;
  const text = document.getText();

  const name = await vscode.window.showInputBox({
    prompt: 'Prompt name',
    placeHolder: 'My awesome prompt',
  });
  if (!name) return;

  const category = await vscode.window.showInputBox({
    prompt: 'Category',
    placeHolder: 'code, creative, analysis, etc.',
  });
  if (!category) return;

  const description = await vscode.window.showInputBox({
    prompt: 'Short description',
    placeHolder: 'What does this prompt do?',
  });
  if (!description) return;

  const uri = document.uri.toString();
  vscode.window.showInformationMessage(
    `Published "${name}" (${category}): ${text.slice(0, 50)}...`
  );

  vscode.commands.executeCommand('promptchain.refreshExplorer');
}
