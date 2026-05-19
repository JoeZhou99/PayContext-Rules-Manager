import * as vscode from 'vscode';
import * as path from 'path';
import { PayRule, RuleCategory, CATEGORY_LABELS, CATEGORY_ICONS } from './types';
import { RuleStore } from './ruleStore';

export class RuleEditorPanel {
  static currentPanel: RuleEditorPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly store: RuleStore,
    private editingRule?: PayRule
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg),
      null,
      this.disposables
    );
    this.render();
  }

  static show(store: RuleStore, rule?: PayRule): void {
    if (RuleEditorPanel.currentPanel) {
      RuleEditorPanel.currentPanel.editingRule = rule;
      RuleEditorPanel.currentPanel.render();
      RuleEditorPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'paycontextRuleEditor',
      rule ? `编辑规则: ${rule.name}` : '新建规则',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    RuleEditorPanel.currentPanel = new RuleEditorPanel(panel, store, rule);
  }

  private async handleMessage(msg: { command: string; data: unknown }): Promise<void> {
    switch (msg.command) {
      case 'save': {
        const data = msg.data as Partial<PayRule>;
        await this.saveRule(data);
        break;
      }
      case 'cancel':
        this.dispose();
        break;
      case 'loadRules':
        this.render();
        break;
    }
  }

  private async saveRule(data: Partial<PayRule>): Promise<void> {
    if (!data.name?.trim()) {
      vscode.window.showErrorMessage('规则名称不能为空');
      return;
    }
    if (!data.content?.trim()) {
      vscode.window.showErrorMessage('规则内容不能为空');
      return;
    }

    const now = new Date().toISOString();
    const rule: PayRule = {
      id: this.editingRule?.id || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name: data.name,
      description: data.description || '',
      category: (data.category as RuleCategory) || 'custom',
      tags: typeof data.tags === 'string'
        ? (data.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
        : (data.tags as string[] | undefined) || [],
      content: data.content,
      filePath: this.editingRule?.filePath || '',
      createdAt: this.editingRule?.createdAt || now,
      updatedAt: now,
    };

    await this.store.saveRule(rule);
    vscode.window.showInformationMessage(`✅ 规则 "${rule.name}" 已保存`);
    this.dispose();
  }

  private render(): void {
    this.panel.title = this.editingRule ? `编辑规则: ${this.editingRule.name}` : '新建规则';
    this.panel.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const r = this.editingRule;
    const categories = Object.entries(CATEGORY_LABELS) as [RuleCategory, string][];

    const categoryOptions = categories
      .map(([value, label]) => {
        const selected = r?.category === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${CATEGORY_ICONS[value]} ${label}</option>`;
      })
      .join('\n');

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>规则编辑器</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-input-border);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --accent: var(--vscode-focusBorder);
      --error: var(--vscode-inputValidation-errorBorder);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--bg);
      color: var(--fg);
      padding: 24px;
      max-width: 900px;
    }
    h1 {
      font-size: 1.4em;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 0.9em;
      opacity: 0.9;
    }
    label .required { color: #f48771; margin-left: 2px; }
    input, select, textarea {
      width: 100%;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--border, #3c3c3c);
      border-radius: 4px;
      padding: 8px 10px;
      font-family: inherit;
      font-size: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
    }
    textarea {
      resize: vertical;
      min-height: 300px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
      line-height: 1.6;
    }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .hint {
      font-size: 0.8em;
      opacity: 0.6;
      margin-top: 4px;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }
    button {
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      transition: background 0.15s;
    }
    .btn-primary {
      background: var(--btn-bg);
      color: var(--btn-fg);
    }
    .btn-primary:hover { background: var(--btn-hover); }
    .btn-secondary {
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--border, #3c3c3c);
    }
    .btn-secondary:hover { opacity: 0.7; }
    .preview-toggle {
      font-size: 0.85em;
      padding: 4px 12px;
      background: transparent;
      border: 1px solid var(--border, #3c3c3c);
      color: var(--fg);
    }
    .char-count {
      text-align: right;
      font-size: 0.78em;
      opacity: 0.5;
      margin-top: 4px;
    }
    .template-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .template-btn {
      font-size: 0.8em;
      padding: 3px 10px;
      background: transparent;
      border: 1px solid var(--accent, #007acc);
      color: var(--accent, #007acc);
      border-radius: 12px;
    }
    .template-btn:hover { opacity: 0.7; }
  </style>
</head>
<body>
  <h1>📝 ${r ? '编辑规则' : '新建规则'}</h1>

  <div class="form-group">
    <label>规则名称 <span class="required">*</span></label>
    <input id="name" type="text" placeholder="例如：Brazil PIX 支付规则" value="${this.esc(r?.name || '')}" />
  </div>

  <div class="form-group">
    <label>描述</label>
    <input id="description" type="text" placeholder="简要描述这条规则的用途" value="${this.esc(r?.description || '')}" />
  </div>

  <div class="row">
    <div class="form-group">
      <label>分类</label>
      <select id="category">
        ${categoryOptions}
      </select>
    </div>
    <div class="form-group">
      <label>标签</label>
      <input id="tags" type="text" placeholder="brazil, pix, latam（逗号分隔）" value="${this.esc((r?.tags || []).join(', '))}" />
    </div>
  </div>

  <div class="form-group">
    <label>规则内容 <span class="required">*</span></label>
    <div class="template-bar">
      <span style="opacity:0.6; font-size:0.8em; align-self:center;">快速模板：</span>
      <button class="template-btn" onclick="insertTemplate('constraint')">约束条件</button>
      <button class="template-btn" onclick="insertTemplate('format')">格式规范</button>
      <button class="template-btn" onclick="insertTemplate('error')">错误处理</button>
      <button class="template-btn" onclick="insertTemplate('flow')">业务流程</button>
    </div>
    <textarea id="content" placeholder="在此输入规则内容（支持 Markdown 格式）...">${this.esc(r?.content || '')}</textarea>
    <div class="char-count" id="charCount">0 字符</div>
    <div class="hint">💡 内容将直接写入 .cursorrules，AI 在每次对话中都会读取这些规则</div>
  </div>

  <div class="actions">
    <button class="btn-primary" onclick="save()">💾 保存规则</button>
    <button class="btn-secondary" onclick="cancel()">取消</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const contentEl = document.getElementById('content');
    const charCountEl = document.getElementById('charCount');

    function updateCharCount() {
      charCountEl.textContent = contentEl.value.length + ' 字符';
    }
    contentEl.addEventListener('input', updateCharCount);
    updateCharCount();

    const TEMPLATES = {
      constraint: \`## 约束条件

- 所有金额必须使用 Decimal 类型，禁止使用浮点数
- 货币代码必须遵循 ISO 4217 标准（如 CNY、USD、BRL）
- 金额精度按货币规定：JPY 为 0 位小数，USD/CNY 为 2 位，BHD 为 3 位\`,
      format: \`## 格式规范

- 金额展示格式：\\\`{symbol}{amount} {currencyCode}\\\`
- API 请求中金额字段统一使用最小单位（如分）
- 日期格式统一使用 ISO 8601：\\\`YYYY-MM-DDTHH:mm:ssZ\\\`\`,
      error: \`## 错误处理

- 支付失败必须返回标准错误码，格式：\\\`PAY_ERR_{CODE}\\\`
- 网络超时重试不超过 3 次，每次间隔指数退避
- 幂等性：相同 orderId 的请求必须返回相同结果\`,
      flow: \`## 业务流程

1. 创建支付订单 → 返回 paymentId
2. 用户确认 → 调用支付网关
3. 异步回调 → 验签 → 更新订单状态
4. 查询接口提供主动轮询能力（最多 30 秒）\`
    };

    function insertTemplate(type) {
      const tmpl = TEMPLATES[type] || '';
      const start = contentEl.selectionStart;
      const before = contentEl.value.slice(0, start);
      const after = contentEl.value.slice(contentEl.selectionEnd);
      contentEl.value = before + (before ? '\\n\\n' : '') + tmpl + after;
      updateCharCount();
      contentEl.focus();
    }

    function save() {
      vscode.postMessage({
        command: 'save',
        data: {
          name: document.getElementById('name').value,
          description: document.getElementById('description').value,
          category: document.getElementById('category').value,
          tags: document.getElementById('tags').value,
          content: contentEl.value,
        }
      });
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    });
  </script>
</body>
</html>`;
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  dispose(): void {
    RuleEditorPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
