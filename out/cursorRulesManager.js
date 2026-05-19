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
exports.CursorRulesManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CURSOR_RULES_FILE = '.cursorrules';
const INJECT_HEADER = '# ===== PayContext Rules (Auto-Injected) =====\n# Do not edit this section manually. Managed by PayContext Rules Manager.\n';
const INJECT_FOOTER = '\n# ===== End of PayContext Rules =====\n';
const SECTION_REGEX = /# ===== PayContext Rules \(Auto-Injected\) =====[\s\S]*?# ===== End of PayContext Rules =====\n?/;
class CursorRulesManager {
    constructor(store) {
        this.store = store;
    }
    getCursorRulesPath() {
        const root = this.store.getWorkspaceRoot();
        if (!root) {
            return undefined;
        }
        return path.join(root, CURSOR_RULES_FILE);
    }
    readCursorRules() {
        const filePath = this.getCursorRulesPath();
        if (!filePath || !fs.existsSync(filePath)) {
            return '';
        }
        return fs.readFileSync(filePath, 'utf-8');
    }
    buildSection(rules) {
        const parts = rules.map(rule => {
            const header = `## [${rule.name}] - ${rule.description}`;
            return `${header}\n\n${rule.content}`;
        });
        return `${INJECT_HEADER}${parts.join('\n\n---\n\n')}${INJECT_FOOTER}`;
    }
    backupIfNeeded(filePath) {
        const config = vscode.workspace.getConfiguration('paycontext');
        if (!config.get('backupCursorRules', true)) {
            return;
        }
        if (!fs.existsSync(filePath)) {
            return;
        }
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
    }
    /**
     * Replace mode: overwrites only the PayContext section, preserving user content
     */
    async injectRules(rules) {
        const filePath = this.getCursorRulesPath();
        if (!filePath) {
            throw new Error('No workspace folder open. Please open a project first.');
        }
        this.backupIfNeeded(filePath);
        const existing = this.readCursorRules();
        const section = this.buildSection(rules);
        let newContent;
        if (SECTION_REGEX.test(existing)) {
            // Replace existing PayContext section
            newContent = existing.replace(SECTION_REGEX, section);
        }
        else {
            // Prepend to existing content
            newContent = existing ? `${section}\n${existing}` : section;
        }
        fs.writeFileSync(filePath, newContent, 'utf-8');
        // Update active rule IDs in meta
        this.store.setActiveRuleIds(rules.map(r => r.id));
        vscode.window.showInformationMessage(`✅ 已注入 ${rules.length} 条规则到 .cursorrules`, '查看文件').then(action => {
            if (action === '查看文件') {
                vscode.workspace.openTextDocument(filePath).then(doc => vscode.window.showTextDocument(doc));
            }
        });
    }
    /**
     * Append mode: add rules to the PayContext section without removing existing ones
     */
    async appendRules(rules) {
        const currentIds = this.store.getActiveRuleIds();
        const existingRules = currentIds
            .map(id => this.store.getRule(id))
            .filter((r) => r !== undefined);
        const mergedIds = new Set([...existingRules.map(r => r.id), ...rules.map(r => r.id)]);
        const mergedRules = Array.from(mergedIds)
            .map(id => this.store.getRule(id))
            .filter((r) => r !== undefined);
        await this.injectRules(mergedRules);
    }
    async clearRules() {
        const filePath = this.getCursorRulesPath();
        if (!filePath) {
            return;
        }
        this.backupIfNeeded(filePath);
        const existing = this.readCursorRules();
        if (SECTION_REGEX.test(existing)) {
            const newContent = existing.replace(SECTION_REGEX, '').trimStart();
            fs.writeFileSync(filePath, newContent, 'utf-8');
        }
        this.store.setActiveRuleIds([]);
        vscode.window.showInformationMessage('🗑️ 已清空 .cursorrules 中的 PayContext 规则');
    }
    getActiveRules() {
        return this.store.getActiveRuleIds()
            .map(id => this.store.getRule(id))
            .filter((r) => r !== undefined);
    }
}
exports.CursorRulesManager = CursorRulesManager;
//# sourceMappingURL=cursorRulesManager.js.map