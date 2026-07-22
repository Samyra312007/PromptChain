import * as vscode from 'vscode';

export async function diffPromptCommand(
  context: vscode.ExtensionContext,
  uri?: vscode.Uri
) {
  if (!uri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No file selected. Select a prompt file to diff.');
      return;
    }
    uri = editor.document.uri;
  }

  const original = await vscode.workspace.openTextDocument(uri);
  const title = `Diff: ${original.fileName}`;

  vscode.commands.executeCommand('vscode.diff', uri, uri, title);
}
