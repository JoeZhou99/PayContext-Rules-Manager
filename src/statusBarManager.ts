import * as vscode from 'vscode';
import { RuleStore } from './ruleStore';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private readonly store: RuleStore) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'paycontext.quickPick';
    this.update();
    store.onDidChange(() => this.update());
  }

  update(): void {
    const config = vscode.workspace.getConfiguration('paycontext');
    if (!config.get<boolean>('showStatusBar', true)) {
      this.statusBarItem.hide();
      return;
    }

    const activeIds = this.store.getActiveRuleIds();
    if (activeIds.length === 0) {
      this.statusBarItem.text = '$(circle-slash) PayContext: 无规则';
      this.statusBarItem.tooltip = '点击快速选择规则';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      const names = activeIds
        .map(id => this.store.getRule(id)?.name || id)
        .join(', ');
      this.statusBarItem.text = `$(zap) PayContext: ${activeIds.length} 条规则已注入`;
      this.statusBarItem.tooltip = `已注入规则：${names}\n点击修改`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
