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
exports.RuleStore = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RuleStore {
    constructor(context) {
        this.context = context;
        this.rules = new Map();
        this.metaFileName = '.meta.json';
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }
    get rulesDir() {
        const config = vscode.workspace.getConfiguration('paycontext');
        const relativePath = config.get('rulesDirectory', '.paycontext/rules');
        const workspaceRoot = this.getWorkspaceRoot();
        if (workspaceRoot) {
            return path.join(workspaceRoot, relativePath);
        }
        // Fallback to global storage
        return path.join(this.context.globalStorageUri.fsPath, 'rules');
    }
    getWorkspaceRoot() {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    ensureRulesDir() {
        if (!fs.existsSync(this.rulesDir)) {
            fs.mkdirSync(this.rulesDir, { recursive: true });
        }
    }
    async loadAll() {
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
    parseRuleFile(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const { meta, content } = this.parseFrontMatter(raw);
            const fileName = path.basename(filePath, '.md');
            const str = (v, fallback) => typeof v === 'string' && v.length > 0 ? v : fallback;
            return {
                id: str(meta.id, fileName),
                name: str(meta.name, fileName),
                description: str(meta.description, ''),
                category: meta.category || 'custom',
                tags: Array.isArray(meta.tags) ? meta.tags : [],
                content: content.trim(),
                filePath,
                createdAt: str(meta.createdAt, new Date().toISOString()),
                updatedAt: str(meta.updatedAt, new Date().toISOString()),
            };
        }
        catch {
            return null;
        }
    }
    parseFrontMatter(raw) {
        const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
        const match = raw.match(fmRegex);
        if (!match) {
            return { meta: {}, content: raw };
        }
        const metaLines = match[1].split('\n');
        const meta = {};
        for (const line of metaLines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) {
                continue;
            }
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            // Handle arrays like: tags: [a, b, c]
            if (value.startsWith('[') && value.endsWith(']')) {
                meta[key] = value
                    .slice(1, -1)
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
            }
            else {
                meta[key] = value;
            }
        }
        return { meta, content: match[2] };
    }
    serializeRule(rule) {
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
    getAllRules() {
        return Array.from(this.rules.values());
    }
    getRulesByCategory(category) {
        return this.getAllRules().filter(r => r.category === category);
    }
    getRule(id) {
        return this.rules.get(id);
    }
    async saveRule(rule) {
        this.ensureRulesDir();
        const filePath = path.join(this.rulesDir, `${rule.id}.md`);
        rule.filePath = filePath;
        rule.updatedAt = new Date().toISOString();
        fs.writeFileSync(filePath, this.serializeRule(rule), 'utf-8');
        this.rules.set(rule.id, rule);
        this._onDidChange.fire();
    }
    async deleteRule(id) {
        const rule = this.rules.get(id);
        if (rule && fs.existsSync(rule.filePath)) {
            fs.unlinkSync(rule.filePath);
        }
        this.rules.delete(id);
        this._onDidChange.fire();
    }
    getCategories() {
        const cats = new Set();
        this.rules.forEach(r => cats.add(r.category));
        return Array.from(cats);
    }
    getMeta() {
        const metaPath = path.join(this.rulesDir, this.metaFileName);
        if (fs.existsSync(metaPath)) {
            try {
                return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            }
            catch {
                // fall through
            }
        }
        return { version: '1.0', lastModified: new Date().toISOString(), activeRuleIds: [] };
    }
    saveMeta(meta) {
        this.ensureRulesDir();
        const metaPath = path.join(this.rulesDir, this.metaFileName);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    }
    getActiveRuleIds() {
        return this.getMeta().activeRuleIds;
    }
    setActiveRuleIds(ids) {
        const meta = this.getMeta();
        meta.activeRuleIds = ids;
        meta.lastModified = new Date().toISOString();
        this.saveMeta(meta);
        this._onDidChange.fire();
    }
}
exports.RuleStore = RuleStore;
//# sourceMappingURL=ruleStore.js.map