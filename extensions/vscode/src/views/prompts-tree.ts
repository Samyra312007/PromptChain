import * as vscode from 'vscode';

export class PromptItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.contextValue = contextValue;
    this.iconPath = new vscode.ThemeIcon('symbol-text');
  }
}

export class PromptChainTreeDataProvider
  implements vscode.TreeDataProvider<PromptItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PromptItem | undefined | null | void
  > = new vscode.EventEmitter<PromptItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    PromptItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PromptItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PromptItem): Promise<PromptItem[]> {
    if (!element) {
      return [
        new PromptItem(
          'My Prompts',
          'Click to view your prompts',
          vscode.TreeItemCollapsibleState.Collapsed,
          'group'
        ),
        new PromptItem(
          'Recent',
          'Recently published prompts',
          vscode.TreeItemCollapsibleState.Collapsed,
          'group'
        ),
        new PromptItem(
          'Favorites',
          'Starred prompts',
          vscode.TreeItemCollapsibleState.Collapsed,
          'group'
        ),
      ];
    }

    if (element.label === 'My Prompts') {
      return [
        new PromptItem('No prompts yet', 'Publish one with Ctrl+Alt+P', vscode.TreeItemCollapsibleState.None),
      ];
    }

    if (element.label === 'Recent') {
      return [
        new PromptItem('Connect to RPC', 'Set rpc URL in settings', vscode.TreeItemCollapsibleState.None),
      ];
    }

    return [];
  }
}
