export interface PayRule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  tags: string[];
  content: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export type RuleCategory =
  | 'payment'      // 支付流程
  | 'currency'     // 币种精度
  | 'compliance'   // 合规要求
  | 'api'          // API 规范
  | 'error'        // 错误处理
  | 'testing'      // 测试规范
  | 'custom';      // 自定义

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  payment: '支付流程',
  currency: '币种精度',
  compliance: '合规要求',
  api: 'API 规范',
  error: '错误处理',
  testing: '测试规范',
  custom: '自定义',
};

export const CATEGORY_ICONS: Record<RuleCategory, string> = {
  payment: '💳',
  currency: '💱',
  compliance: '⚖️',
  api: '🔌',
  error: '🚨',
  testing: '🧪',
  custom: '📝',
};

export interface InjectionRecord {
  projectPath: string;
  injectedRuleIds: string[];
  injectedAt: string;
  mode: 'replace' | 'append';
}

export interface RuleStoreMeta {
  version: string;
  lastModified: string;
  activeRuleIds: string[];
}
