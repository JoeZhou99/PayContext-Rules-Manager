"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveRulesTreeProvider = exports.RulesTreeProvider = exports.CategoryTreeItem = exports.RuleTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
class RuleTreeItem extends vscode.TreeItem {
    constructor(rule, isActive) {
        super(rule.name, vscode.TreeItemCollapsibleState.None);
        this.rule = rule;
        this.isActive = isActive;
        this.description = rule.description;
        this.tooltip = new vscode.MarkdownString(`**${rule.name}**\n\n${rule.description}\n\n_分类: ${types_1.CATEGORY_LABELS[rule.category]}_\n\n_标签: ${rule.tags.join(', ') || '无'}_`);
        this.contextValue = 'rule';
        if (isActive) {
            this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            this.description = `${rule.description} ✓ 已注入`;
        }
        else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        this.command = {
            command: 'paycontext.previewRule',
            title: '预览规则',
            arguments: [rule],
        };
    }
}
exports.RuleTreeItem = RuleTreeItem;
class CategoryTreeItem extends vscode.TreeItem {
    constructor(category, count) {
        super(`${types_1.CATEGORY_ICONS[category]} ${types_1.CATEGORY_LABELS[category]}`, vscode.TreeItemCollapsibleState.Expanded);
        this.category = category;
        this.count = count;
        this.description = `${count} 条规则`;
        this.contextValue = 'category';
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}
exports.CategoryTreeItem = CategoryTreeItem;
class RulesTreeProvider {
    constructor(store) {
        this.store = store;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        store.onDidChange(() => this.refresh());
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return this.getCategoryItems();
        }
        if (element instanceof CategoryTreeItem) {
            return this.getRuleItems(element.category);
        }
        return [];
    }
    getCategoryItems() {
        const categories = this.store.getCategories();
        if (categories.length === 0) {
            return [];
        }
        return categories.map(cat => {
            const rules = this.store.getRulesByCategory(cat);
            return new CategoryTreeItem(cat, rules.length);
        });
    }
    getRuleItems(category) {
        const activeIds = new Set(this.store.getActiveRuleIds());
        return this.store.getRulesByCategory(category).map(rule => new RuleTreeItem(rule, activeIds.has(rule.id)));
    }
}
exports.RulesTreeProvider = RulesTreeProvider;
class ActiveRulesTreeProvider {
    constructor(store) {
        this.store = store;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        store.onDidChange(() => this.refresh());
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const activeIds = this.store.getActiveRuleIds();
        if (activeIds.length === 0) {
            const empty = new vscode.TreeItem('暂无注入规则');
            empty.description = '请从规则库中选择规则注入';
            empty.iconPath = new vscode.ThemeIcon('info');
            return [empty];
        }
        return activeIds
            .map(id => this.store.getRule(id))
            .filter((r) => r !== undefined)
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
exports.ActiveRulesTreeProvider = ActiveRulesTreeProvider;
//# sourceMappingURL=rulesTreeProvider.js.map