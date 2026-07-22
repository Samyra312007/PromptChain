import * as vscode from 'vscode';

export async function listPromptsCommand(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'promptchainList',
    'My Prompts',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent();
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; }
    .prompt-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
    }
    .prompt-card h3 { margin: 0 0 4px; }
    .prompt-card p { margin: 0; color: var(--vscode-descriptionForeground); }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 11px;
    }
  </style>
</head>
<body>
  <h2>My Prompts</h2>
  <p>Connect to a Solana RPC endpoint to view your published prompts.</p>
  <p>Use <code>promptchain list</code> in the terminal, or configure a wallet in settings.</p>
</body>
</html>`;
}
