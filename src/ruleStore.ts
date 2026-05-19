import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PayRule, RuleCategory, RuleStoreMeta } from './types';

export class RuleStore {
  private rules: Map<string, PayRule> = new Map();
  private readonly metaFileName = '.meta.json';
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  get rulesDir(): string {
    const config = vscode.workspace.getConfiguration('paycontext');
    const relativePath = config.get<string>('rulesDirectory', '.paycontext/rules');
    const workspaceRoot = this.getWorkspaceRoot();
    if (workspaceRoot) {
      return path.join(workspaceRoot, relativePath);
    }
    // Fallback to global storage
    return path.join(this.context.globalStorageUri.fsPath, 'rules');
  }

  getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  ensureRulesDir(): void {
    if (!fs.existsSync(this.rulesDir)) {
      fs.mkdirSync(this.rulesDir, { recursive: true });
    }
  }

  async loadAll(): Promise<void> {
    this.ensureRulesDir();
    this.rules.clear();

    const files = fs.readdirSync(this.rulesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(this.rulesDir, file);
      const rule = this.parseRuleFile(filePath);
      if (rule) {
        this.rules.set(rule.id, rule);
      }
    }
    this._onDidChange.fire();
  }

  private parseRuleFile(filePath: string): PayRule | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { meta, content } = this.parseFrontMatter(raw);

      const fileName = path.basename(filePath, '.md');
      const str = (v: unknown, fallback: string): string =>
        typeof v === 'string' && v.length > 0 ? v : fallback;
      return {
        id: str(meta.id, fileName),
        name: str(meta.name, fileName),
        description: str(meta.description, ''),
        category: (meta.category as RuleCategory) || 'custom',
        tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
        content: content.trim(),
        filePath,
        createdAt: str(meta.createdAt, new Date().toISOString()),
        updatedAt: str(meta.updatedAt, new Date().toISOString()),
      };
    } catch {
      return null;
    }
  }

  private parseFrontMatter(raw: string): { meta: Record<string, unknown>; content: string } {
    const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
    const match = raw.match(fmRegex);
    if (!match) {
      return { meta: {}, content: raw };
    }

    const metaLines = match[1].split('\n');
    const meta: Record<string, unknown> = {};
    for (const line of metaLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) { continue; }
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      // Handle arrays like: tags: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        meta[key] = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      } else {
        meta[key] = value;
      }
    }
    return { meta, content: match[2] };
  }

  private serializeRule(rule: PayRule): string {
    const tags = rule.tags.length > 0 ? `[${rule.tags.join(', ')}]` : '[]';
    const frontMatter = [
      '---',
      `id: ${rule.id}`,
      `name: ${rule.name}`,
      `description: ${rule.description}`,
      `category: ${rule.category}`,
      `tags: ${tags}`,
      `createdAt: ${rule.createdAt}`,
      `updatedAt: ${new Date().toISOString()}`,
      '---',
      '',
      rule.content,
    ].join('\n');
    return frontMatter;
  }

  getAllRules(): PayRule[] {
    return Array.from(this.rules.values());
  }

  getRulesByCategory(category: RuleCategory): PayRule[] {
    return this.getAllRules().filter(r => r.category === category);
  }

  getRule(id: string): PayRule | undefined {
    return this.rules.get(id);
  }

  async saveRule(rule: PayRule): Promise<void> {
    this.ensureRulesDir();
    const filePath = path.join(this.rulesDir, `${rule.id}.md`);
    rule.filePath = filePath;
    rule.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, this.serializeRule(rule), 'utf-8');
    this.rules.set(rule.id, rule);
    this._onDidChange.fire();
  }

  async deleteRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (rule && fs.existsSync(rule.filePath)) {
      fs.unlinkSync(rule.filePath);
    }
    this.rules.delete(id);
    this._onDidChange.fire();
  }

  getCategories(): RuleCategory[] {
    const cats = new Set<RuleCategory>();
    this.rules.forEach(r => cats.add(r.category));
    return Array.from(cats);
  }

  getMeta(): RuleStoreMeta {
    const metaPath = path.join(this.rulesDir, this.metaFileName);
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        // fall through
      }
    }
    return { version: '1.0', lastModified: new Date().toISOString(), activeRuleIds: [] };
  }

  saveMeta(meta: RuleStoreMeta): void {
    this.ensureRulesDir();
    const metaPath = path.join(this.rulesDir, this.metaFileName);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  getActiveRuleIds(): string[] {
    return this.getMeta().activeRuleIds;
  }

  setActiveRuleIds(ids: string[]): void {
    const meta = this.getMeta();
    meta.activeRuleIds = ids;
    meta.lastModified = new Date().toISOString();
    this.saveMeta(meta);
    this._onDidChange.fire();
  }
}
