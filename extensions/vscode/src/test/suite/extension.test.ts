import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('promptchain.promptchain-vscode'));
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('promptchain.publish'));
    assert.ok(commands.includes('promptchain.listPrompts'));
    assert.ok(commands.includes('promptchain.diffPrompt'));
    assert.ok(commands.includes('promptchain.forkPrompt'));
    assert.ok(commands.includes('promptchain.setLicense'));
    assert.ok(commands.includes('promptchain.refreshExplorer'));
  });
});
