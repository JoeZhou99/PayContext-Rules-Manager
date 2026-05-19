import * as vscode from 'vscode';
import { PayRule, RuleCategory, CATEGORY_LABELS, CATEGORY_ICONS } from './types';
import { RuleStore } from './ruleStore';

export class RuleTreeItem extends vscode.TreeItem {
  constructor(
    public readonly rule: PayRule,
    public readonly isActive: boolean
  ) {
    super(rule.name, vscode.TreeItemCollapsibleState.None);

    this.description = rule.description;
    this.tooltip = new vscode.MarkdownString(
      `**${rule.name}**\n\n${rule.description}\n\n_分类: ${CATEGORY_LABELS[rule.category]}_\n\n_标签: ${rule.tags.join(', ') || '无'}_`
    );
    this.contextValue = 'rule';

    if (isActive) {
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
      this.description = `${rule.description} ✓ 已注入`;
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    }

    this.command = {
      command: 'paycontext.previewRule',
      title: '预览规则',
      arguments: [rule],
    };
  }
}

export class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly category: RuleCategory,
    public readonly count: number
  ) {
    super(
      `${CATEGORY_ICONS[category]} ${CATEGORY_LABELS[category]}`,
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.description = `${count} 条规则`;
    this.contextValue = 'category';
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class RulesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly store: RuleStore) {
    store.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return this.getCategoryItems();
    }

    if (element instanceof CategoryTreeItem) {
      return this.getRuleItems(element.category);
    }

    return [];
  }

  private getCategoryItems(): CategoryTreeItem[] {
    const categories = this.store.getCategories();
    if (categories.length === 0) {
      return [];
    }
    return categories.map(cat => {
      const rules = this.store.getRulesByCategory(cat);
      return new CategoryTreeItem(cat, rules.length);
    });
  }

  private getRuleItems(category: RuleCategory): RuleTreeItem[] {
    const activeIds = new Set(this.store.getActiveRuleIds());
    return this.store.getRulesByCategory(category).map(
      rule => new RuleTreeItem(rule, activeIds.has(rule.id))
    );
  }
}

export class ActiveRulesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly store: RuleStore) {
    store.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const activeIds = this.store.getActiveRuleIds();
    if (activeIds.length === 0) {
      const empty = new vscode.TreeItem('暂无注入规则');
      empty.description = '请从规则库中选择规则注入';
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    return activeIds
      .map(id => this.store.getRule(id))
      .filter((r): r is PayRule => r !== undefined)
      .map(rule => {
        const item = new RuleTreeItem(rule, true);
        item.command = {
          command: 'paycontext.previewRule',
          title: '预览规则',
          arguments: [rule],
        };
        return item;
      });
  }
}
