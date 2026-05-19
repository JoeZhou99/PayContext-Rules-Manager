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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ruleStore_1 = require("./ruleStore");
const cursorRulesManager_1 = require("./cursorRulesManager");
const rulesTreeProvider_1 = require("./rulesTreeProvider");
const ruleEditorPanel_1 = require("./ruleEditorPanel");
const statusBarManager_1 = require("./statusBarManager");
const templateInitializer_1 = require("./templateInitializer");
const types_1 = require("./types");
async function activate(context) {
    const store = new ruleStore_1.RuleStore(context);
    const cursorManager = new cursorRulesManager_1.CursorRulesManager(store);
    const statusBar = new statusBarManager_1.StatusBarManager(store);
    // Load existing rules
    await store.loadAll();
    // Tree providers
    const rulesProvider = new rulesTreeProvider_1.RulesTreeProvider(store);
    const activeProvider = new rulesTreeProvider_1.ActiveRulesTreeProvider(store);
    vscode.window.createTreeView('paycontext.rulesView', {
        treeDataProvider: rulesProvider,
        showCollapseAll: true,
    });
    vscode.window.createTreeView('paycontext.activeView', {
        treeDataProvider: activeProvider,
    });
    // Auto-inject on open
    const config = vscode.workspace.getConfiguration('paycontext');
    if (config.get('autoInjectOnOpen', false)) {
        const activeIds = store.getActiveRuleIds();
        if (activeIds.length > 0) {
            const rules = activeIds
                .map(id => store.getRule(id))
                .filter((r) => r !== undefined);
            if (rules.length > 0) {
                await cursorManager.injectRules(rules);
            }
        }
    }
    // === Commands ===
    context.subscriptions.push(vscode.commands.registerCommand('paycontext.quickPick', async () => {
        await showQuickPick(store, cursorManager);
    }), vscode.commands.registerCommand('paycontext.injectRule', async (item) => {
        const rule = item?.rule;
        if (!rule) {
            return;
        }
        const action = await vscode.window.showQuickPick(['替换注入（覆盖当前规则）', '追加注入（保留当前规则）'], { placeHolder: `注入规则：${rule.name}` });
        if (!action) {
            return;
        }
        if (action.includes('替换')) {
            await cursorManager.injectRules([rule]);
        }
        else {
            await cursorManager.appendRules([rule]);
        }
    }), vscode.commands.registerCommand('paycontext.appendRule', async (item) => {
        const rule = item?.rule;
        if (!rule) {
            return;
        }
        await cursorManager.appendRules([rule]);
    }), vscode.commands.registerCommand('paycontext.clearRules', async () => {
        const confirm = await vscode.window.showWarningMessage('确认清空 .cursorrules 中的所有 PayContext 规则？', { modal: true }, '确认清空');
        if (confirm === '确认清空') {
            await cursorManager.clearRules();
        }
    }), vscode.commands.registerCommand('paycontext.newRule', () => {
        ruleEditorPanel_1.RuleEditorPanel.show(store);
    }), vscode.commands.registerCommand('paycontext.editRule', (item) => {
        const rule = item?.rule;
        if (!rule) {
            return;
        }
        ruleEditorPanel_1.RuleEditorPanel.show(store, rule);
    }), vscode.commands.registerCommand('paycontext.deleteRule', async (item) => {
        const rule = item?.rule;
        if (!rule) {
            return;
        }
        const confirm = await vscode.window.showWarningMessage(`确认删除规则 "${rule.name}"？`, { modal: true }, '确认删除');
        if (confirm === '确认删除') {
            await store.deleteRule(rule.id);
            vscode.window.showInformationMessage(`🗑️ 规则 "${rule.name}" 已删除`);
        }
    }), vscode.commands.registerCommand('paycontext.openRuleEditor', () => {
        ruleEditorPanel_1.RuleEditorPanel.show(store);
    }), vscode.commands.registerCommand('paycontext.initTemplates', async () => {
        const confirm = await vscode.window.showInformationMessage('初始化预置规则模板？这将在你的项目目录 .paycontext/rules/ 下创建示例规则文件。', '初始化', '取消');
        if (confirm !== '初始化') {
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: '正在初始化规则模板...' }, async () => {
            await (0, templateInitializer_1.initializeTemplates)(store);
        });
        vscode.window.showInformationMessage('✅ 预置规则模板已创建！');
    }), vscode.commands.registerCommand('paycontext.previewRule', (rule) => {
        const panel = vscode.window.createWebviewPanel('paycontextPreview', `预览: ${rule.name}`, vscode.ViewColumn.Beside, { enableScripts: false });
        panel.webview.html = buildPreviewHtml(rule);
    }), vscode.commands.registerCommand('paycontext.showStatus', async () => {
        const active = cursorManager.getActiveRules();
        if (active.length === 0) {
            vscode.window.showInformationMessage('当前没有注入任何规则到 .cursorrules');
        }
        else {
            const names = active.map(r => `• ${r.name}`).join('\n');
            vscode.window.showInformationMessage(`当前已注入 ${active.length} 条规则：\n${names}`);
        }
    }));
    context.subscriptions.push(statusBar);
    // Show welcome if no rules exist
    if (store.getAllRules().length === 0) {
        const action = await vscode.window.showInformationMessage('👋 欢迎使用 PayContext Rules Manager！是否要初始化预置的支付业务规则模板？', '初始化模板', '稍后');
        if (action === '初始化模板') {
            await (0, templateInitializer_1.initializeTemplates)(store);
            vscode.window.showInformationMessage('✅ 预置规则模板已创建！在侧边栏 PayContext Rules 中查看。');
        }
    }
}
async function showQuickPick(store, cursorManager) {
    const allRules = store.getAllRules();
    if (allRules.length === 0) {
        const action = await vscode.window.showWarningMessage('还没有任何规则，是否初始化预置模板？', '初始化');
        if (action === '初始化') {
            await (0, templateInitializer_1.initializeTemplates)(store);
        }
        return;
    }
    const activeIds = new Set(store.getActiveRuleIds());
    const items = [
        { label: '$(clear-all) 清空所有规则', action: 'clear', kind: vscode.QuickPickItemKind.Default },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
    ];
    const byCategory = new Map();
    for (const rule of allRules) {
        const cat = rule.category;
        if (!byCategory.has(cat)) {
            byCategory.set(cat, []);
        }
        byCategory.get(cat).push(rule);
    }
    for (const [cat, rules] of byCategory) {
        const catLabel = types_1.CATEGORY_LABELS[cat] || cat;
        const icon = types_1.CATEGORY_ICONS[cat] || '📋';
        items.push({
            label: `${icon} ${catLabel}`,
            kind: vscode.QuickPickItemKind.Separator,
        });
        for (const rule of rules) {
            const isActive = activeIds.has(rule.id);
            items.push({
                label: `${isActive ? '$(check) ' : '$(circle-outline) '}${rule.name}`,
                description: rule.description,
                detail: rule.tags.length > 0 ? `标签: ${rule.tags.join(', ')}` : undefined,
                ruleId: rule.id,
                picked: isActive,
            });
        }
    }
    const qp = vscode.window.createQuickPick();
    qp.items = items;
    qp.canSelectMany = true;
    qp.placeholder = '选择要注入的规则（可多选），按 Enter 确认';
    qp.title = 'PayContext: 选择规则注入到 .cursorrules';
    // Pre-select active rules
    qp.selectedItems = items.filter(i => i.ruleId && activeIds.has(i.ruleId));
    qp.onDidAccept(async () => {
        const selected = qp.selectedItems;
        qp.hide();
        const clearAction = selected.find(i => i.action === 'clear');
        if (clearAction) {
            await cursorManager.clearRules();
            return;
        }
        const selectedRules = selected
            .filter(i => i.ruleId)
            .map(i => store.getRule(i.ruleId))
            .filter((r) => r !== undefined);
        if (selectedRules.length === 0) {
            await cursorManager.clearRules();
        }
        else {
            await cursorManager.injectRules(selectedRules);
        }
    });
    qp.show();
}
function buildPreviewHtml(rule) {
    const { CATEGORY_LABELS: CL, CATEGORY_ICONS: CI } = require('./types');
    const catLabel = CL[rule.category] || rule.category;
    const catIcon = CI[rule.category] || '📋';
    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px 28px;
      line-height: 1.7;
    }
    h1 { font-size: 1.3em; margin-bottom: 4px; }
    .meta { opacity: 0.65; font-size: 0.85em; margin-bottom: 20px; }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 0.8em;
      margin-right: 4px;
    }
    pre, code {
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
    }
    pre { padding: 12px; overflow-x: auto; }
    code { padding: 1px 5px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 8px 12px; text-align: left; }
    th { background: var(--vscode-list-hoverBackground); }
    hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 16px 0; }
    blockquote { border-left: 3px solid var(--vscode-focusBorder); margin: 0; padding-left: 14px; opacity: 0.85; }
  </style>
</head>
<body>
  <h1>${catIcon} ${rule.name}</h1>
  <div class="meta">
    ${rule.description ? `<span>${rule.description}</span> · ` : ''}
    <span>分类: ${catLabel}</span>
    ${rule.tags.length > 0 ? ' · ' + rule.tags.map(t => `<span class="tag">${t}</span>`).join('') : ''}
  </div>
  <hr>
  <div id="content"></div>
  <script>
    // Simple markdown renderer
    const raw = ${JSON.stringify(rule.content)};
    document.getElementById('content').innerHTML = renderMd(raw);

    function renderMd(md) {
      return md
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        // Code blocks
        .replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, (_,lang,code)=>\`<pre><code>\${code}</code></pre>\`)
        // Inline code
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        // Table rows
        .replace(/^\\|(.+)\\|$/gm, (line) => {
          const cells = line.slice(1,-1).split('|').map(c=>c.trim());
          return '<tr>' + cells.map(c=>\`<td>\${c}</td>\`).join('') + '</tr>';
        })
        .replace(/(<tr>.*<\\/tr>\\n?)+/gs, match => \`<table>\${match}</table>\`)
        // HR
        .replace(/^---$/gm, '<hr>')
        // List items
        .replace(/^[•\\-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\\/li>\\n?)+/gs, match => \`<ul>\${match}</ul>\`)
        // Numbered list
        .replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>')
        // Paragraph breaks
        .replace(/\\n\\n/g, '</p><p>')
        .replace(/^(?!<[htuplio])/gm, '')
        .trim();
    }
  </script>
</body>
</html>`;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map