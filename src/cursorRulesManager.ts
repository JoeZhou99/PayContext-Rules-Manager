import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PayRule } from './types';
import { RuleStore } from './ruleStore';

const CURSOR_RULES_FILE = '.cursorrules';
const INJECT_HEADER = '# ===== PayContext Rules (Auto-Injected) =====\n# Do not edit this section manually. Managed by PayContext Rules Manager.\n';
const INJECT_FOOTER = '\n# ===== End of PayContext Rules =====\n';
const SECTION_REGEX = /# ===== PayContext Rules \(Auto-Injected\) =====[\s\S]*?# ===== End of PayContext Rules =====\n?/;

export class CursorRulesManager {
  constructor(private readonly store: RuleStore) {}

  getCursorRulesPath(): string | undefined {
    const root = this.store.getWorkspaceRoot();
    if (!root) { return undefined; }
    return path.join(root, CURSOR_RULES_FILE);
  }

  readCursorRules(): string {
    const filePath = this.getCursorRulesPath();
    if (!filePath || !fs.existsSync(filePath)) { return ''; }
    return fs.readFileSync(filePath, 'utf-8');
  }

  private buildSection(rules: PayRule[]): string {
    const parts = rules.map(rule => {
      const header = `## [${rule.name}] - ${rule.description}`;
      return `${header}\n\n${rule.content}`;
    });
    return `${INJECT_HEADER}${parts.join('\n\n---\n\n')}${INJECT_FOOTER}`;
  }

  private backupIfNeeded(filePath: string): void {
    const config = vscode.workspace.getConfiguration('paycontext');
    if (!config.get<boolean>('backupCursorRules', true)) { return; }
    if (!fs.existsSync(filePath)) { return; }

    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);
  }

  /**
   * Replace mode: overwrites only the PayContext section, preserving user content
   */
  async injectRules(rules: PayRule[]): Promise<void> {
    const filePath = this.getCursorRulesPath();
    if (!filePath) {
      throw new Error('No workspace folder open. Please open a project first.');
    }

    this.backupIfNeeded(filePath);

    const existing = this.readCursorRules();
    const section = this.buildSection(rules);

    let newContent: string;
    if (SECTION_REGEX.test(existing)) {
      // Replace existing PayContext section
      newContent = existing.replace(SECTION_REGEX, section);
    } else {
      // Prepend to existing content
      newContent = existing ? `${section}\n${existing}` : section;
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');

    // Update active rule IDs in meta
    this.store.setActiveRuleIds(rules.map(r => r.id));

    vscode.window.showInformationMessage(
      `✅ 已注入 ${rules.length} 条规则到 .cursorrules`,
      '查看文件'
    ).then(action => {
      if (action === '查看文件') {
        vscode.workspace.openTextDocument(filePath).then(doc => vscode.window.showTextDocument(doc));
      }
    });
  }

  /**
   * Append mode: add rules to the PayContext section without removing existing ones
   */
  async appendRules(rules: PayRule[]): Promise<void> {
    const currentIds = this.store.getActiveRuleIds();
    const existingRules = currentIds
      .map(id => this.store.getRule(id))
      .filter((r): r is PayRule => r !== undefined);

    const mergedIds = new Set([...existingRules.map(r => r.id), ...rules.map(r => r.id)]);
    const mergedRules = Array.from(mergedIds)
      .map(id => this.store.getRule(id))
      .filter((r): r is PayRule => r !== undefined);

    await this.injectRules(mergedRules);
  }

  async clearRules(): Promise<void> {
    const filePath = this.getCursorRulesPath();
    if (!filePath) { return; }

    this.backupIfNeeded(filePath);

    const existing = this.readCursorRules();
    if (SECTION_REGEX.test(existing)) {
      const newContent = existing.replace(SECTION_REGEX, '').trimStart();
      fs.writeFileSync(filePath, newContent, 'utf-8');
    }

    this.store.setActiveRuleIds([]);
    vscode.window.showInformationMessage('🗑️ 已清空 .cursorrules 中的 PayContext 规则');
  }

  getActiveRules(): PayRule[] {
    return this.store.getActiveRuleIds()
      .map(id => this.store.getRule(id))
      .filter((r): r is PayRule => r !== undefined);
  }
}
