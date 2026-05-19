import * as fs from 'fs';
import * as path from 'path';
import { RuleStore } from './ruleStore';

interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  content: string;
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'common-currency-precision',
    name: '币种精度规则',
    description: '各国货币的小数位数精度标准',
    category: 'currency',
    tags: ['currency', 'precision', 'iso4217'],
    content: `## 币种精度规则（ISO 4217）

### 核心原则
- **禁止使用浮点数**处理金额。必须使用 \`Decimal\` / \`BigDecimal\` 或整数最小单位。
- 所有货币代码必须符合 **ISO 4217** 三位大写字母标准。

### 各货币精度（小数位数）

| 货币代码 | 国家/地区 | 精度 | 示例 |
|---------|---------|------|------|
| JPY     | 日本     | 0    | ¥1234 |
| KRW     | 韩国     | 0    | ₩5000 |
| USD     | 美国     | 2    | $12.34 |
| EUR     | 欧元区   | 2    | €12.34 |
| CNY     | 中国     | 2    | ¥12.34 |
| GBP     | 英国     | 2    | £12.34 |
| BRL     | 巴西     | 2    | R$12.34 |
| MXN     | 墨西哥   | 2    | MX$12.34 |
| INR     | 印度     | 2    | ₹12.34 |
| BHD     | 巴林     | 3    | BHD 1.234 |
| KWD     | 科威特   | 3    | KWD 1.234 |
| OMR     | 阿曼     | 3    | OMR 1.234 |

### 金额处理规范
\`\`\`
// 正确：使用最小单位（分）存储
amount_cents: 1234  // 代表 $12.34

// 正确：使用 Decimal 类型
amount: Decimal("12.34")

// 错误：浮点数精度丢失
amount: 12.34  // float，严禁用于金额计算
\`\`\`

### API 传输规范
- 请求/响应中金额字段统一使用**字符串**类型，避免 JSON 解析精度丢失
- 格式：\`"amount": "12.34"\` + \`"currency": "USD"\`
`,
  },
  {
    id: 'brazil-pix-rules',
    name: 'Brazil PIX 支付规则',
    description: '巴西 PIX 即时支付系统集成规范',
    category: 'payment',
    tags: ['brazil', 'pix', 'latam', 'instant-payment'],
    content: `## Brazil PIX 支付规则

### PIX 基础规范
- 货币：BRL（巴西雷亚尔），精度 2 位小数
- 结算：7×24 即时到账，单笔无手续费（个人），法人限额不同
- 交易类型：PIX COBRAR（收款）/ PIX ENVIAR（付款）

### PIX Key 类型
| Key 类型 | 格式 | 示例 |
|---------|------|------|
| CPF     | 11位数字（个人税号）| 12345678901 |
| CNPJ    | 14位数字（企业税号）| 12345678000100 |
| 手机号  | +55 + DDD + 号码 | +5511999998888 |
| 邮箱    | 标准邮箱格式 | user@email.com |
| EVP     | 随机UUID | uuid-v4 |

### QR Code 规范
- **Static QR（静态码）**：金额可空，适合收款码
- **Dynamic QR（动态码）**：包含 txid，支持对账，推荐用于电商
- EMV 格式，使用 CRC-16 校验

### 关键字段
\`\`\`json
{
  "calendario": { "expiracao": 3600 },
  "devedor": { "cpf": "12345678901", "nome": "João Silva" },
  "valor": { "original": "12.34" },
  "chave": "sua-chave-pix",
  "solicitacaoPagador": "Pagamento do pedido #12345",
  "txid": "unico-id-da-transacao-32chars"
}
\`\`\`

### 回调（Webhook）处理
- 路径：\`POST /pix/{txid}\` 或 \`POST /pix\`
- 验签：使用 mTLS（双向 TLS），Banco Central 要求
- 幂等性：相同 \`txid\` 可能多次回调，需去重处理
- 状态：\`ATIVA\` → \`CONCLUIDA\` / \`REMOVIDA_PELO_USUARIO_RECEBEDOR\`

### 合规要求
- 必须在沙盒（Sandbox HML）充分测试后才能上生产
- 所有 PIX 交易必须记录完整日志（含 txid、时间戳、金额）
- 退款通过 \`Devolução\` 接口，有 90 天期限
`,
  },
  {
    id: 'japan-payment-rules',
    name: 'Japan 支付规则',
    description: '日本市场支付集成规范（JCB、コンビニ等）',
    category: 'payment',
    tags: ['japan', 'jcb', 'konbini', 'jpy'],
    content: `## Japan 支付规则

### 货币规范
- 货币：JPY（日元），**精度 0 位**（无小数）
- 金额传输和存储均为整数，例如：\`"amount": 1234\`
- 禁止出现小数点，例如：~~\`1234.00\`~~

### 支付方式
| 方式 | 说明 | 特点 |
|-----|------|------|
| JCB 卡 | 日本本土信用卡 | 需要单独授权协议 |
| コンビニ払い | 便利店付款 | 需生成条形码，72h内支付 |
| Pay-easy | 网银转账 | 需支付编号+收款企业码 |
| PayPay | 二维码支付 | 最大市场份额 |
| 楽天ペイ | 楽天支付 | 绑定楽天会员积分 |

### コンビニ（便利店）付款规范
- 生成收款码：调用 \`/charges\`，\`payment_method_types: ["konbini"]\`
- 有效期：默认 3 天（可配置，最长 60 天）
- 支持店铺：Lawson / FamilyMart / Ministop / Seicomart / Seven-Eleven
- 支付完成后异步 Webhook 通知

### 3D Secure 要求
- 日本监管要求 2025 年起强制 3DS2.0（EMV 3-D Secure）
- 所有信用卡交易必须支持 3DS Challenge Flow

### 特殊注意事项
- 消費税（消費税）：10%（外食 8%），金额展示必须含税
- 姓名字段：支持全角假名（フリガナ），用于身份验证
- 地址格式：都道府県 → 市区町村 → 番地（与中文相反的顺序）
`,
  },
  {
    id: 'pci-dss-compliance',
    name: 'PCI DSS 合规规则',
    description: '支付卡行业数据安全标准合规要求',
    category: 'compliance',
    tags: ['pci-dss', 'security', 'compliance', 'card-data'],
    content: `## PCI DSS 合规规则

### 核心原则：绝不触碰原始卡号（PAN）

### 禁止事项（代码层面）
- ❌ 禁止在日志中打印卡号、CVV、有效期
- ❌ 禁止在数据库中明文存储完整 PAN
- ❌ 禁止在 URL 参数中传递卡片信息
- ❌ 禁止在前端 JS 中处理原始卡号（使用 Tokenization）
- ❌ 禁止在非加密信道（HTTP）传输卡片数据

### 必须遵守
- ✅ 卡号展示仅保留后 4 位：\`**** **** **** 1234\`
- ✅ CVV 在验证后立即丢弃，严禁存储
- ✅ PAN 存储必须使用强加密（AES-256）或 Token 化
- ✅ 所有支付接口必须使用 TLS 1.2+
- ✅ 密钥轮换：加密密钥有效期不超过 1 年

### Token 化规范
\`\`\`
// 前端使用 SDK 生成 token（不经过自己服务器）
const token = await paymentSDK.tokenize({
  cardNumber: userInput,  // 直接发往支付网关
  expiry: "12/26",
  cvv: "123"
});
// 后端仅使用 token
chargeWithToken(token.id, amount);
\`\`\`

### 日志脱敏规则
\`\`\`
// 错误示例
log.info("Processing card: 4111111111111111")

// 正确示例  
log.info("Processing card: ****1111")
log.info("Processing token: tok_xxxxxxxxxxxx")
\`\`\`

### 审计要求
- 所有支付操作必须记录：操作人、时间、IP、操作类型
- 日志保留最少 1 年，最近 3 个月可在线查询
- 定期进行渗透测试（至少每年一次）
`,
  },
  {
    id: 'payment-error-handling',
    name: '支付错误处理规范',
    description: '支付场景下的错误码设计和重试策略',
    category: 'error',
    tags: ['error-handling', 'retry', 'idempotency'],
    content: `## 支付错误处理规范

### 错误码体系
\`\`\`
PAY_{LAYER}_{CODE}

层级（LAYER）：
  GATEWAY  - 支付网关错误
  BANK     - 银行/发卡机构错误  
  RISK     - 风控拒绝
  BUSINESS - 业务逻辑错误
  SYSTEM   - 系统错误

示例：
  PAY_GATEWAY_TIMEOUT      - 网关超时
  PAY_BANK_INSUFFICIENT    - 余额不足
  PAY_RISK_FRAUD           - 风控拒绝
  PAY_BUSINESS_EXPIRED     - 订单已过期
\`\`\`

### 重试策略
| 错误类型 | 是否重试 | 最大次数 | 退避策略 |
|---------|---------|---------|---------|
| 网络超时  | ✅ 是   | 3次     | 指数退避 (1s, 2s, 4s) |
| 余额不足  | ❌ 否   | -       | 提示用户 |
| 风控拒绝  | ❌ 否   | -       | 联系客服 |
| 重复请求  | -       | -       | 返回原结果 |
| 系统错误  | ✅ 是   | 2次     | 固定间隔 5s |

### 幂等性设计（必须实现）
\`\`\`
// 每个支付请求必须携带唯一幂等键
POST /payments
Headers:
  Idempotency-Key: {uuid-v4}  // 客户端生成，相同 Key 返回相同结果

// 服务端处理
if (alreadyProcessed(idempotencyKey)):
    return cachedResult  // 直接返回，不重复扣款
\`\`\`

### 用户提示规范
- 余额不足：提示具体差额，引导充值
- 卡被拒绝：不透露拒绝原因（安全考虑），建议联系发卡行
- 系统错误：提供错误追踪 ID（traceId），方便排查
- 超时：提示用户"请勿重复操作"，提供订单查询入口

### 对账异常处理
- 支付成功但通知失败 → 主动轮询或接收补发通知
- 金额不一致 → 自动冻结，人工审核
- 重复到账 → 自动退款并告警
`,
  },
  {
    id: 'refund-rules',
    name: '退款业务规则',
    description: '退款流程、时限和金额校验规范',
    category: 'payment',
    tags: ['refund', 'reversal', 'chargeback'],
    content: `## 退款业务规则

### 退款类型
| 类型 | 场景 | 时限 |
|-----|------|------|
| Void（撤销）| 交易当日，未结算前 | T+0 日终前 |
| Refund（退款）| 已结算交易 | 通常 90~180 天 |
| Chargeback（拒付）| 持卡人投诉 | 银行发起，30~45 天 |

### 金额校验规则
- 单笔退款金额 ≤ 原交易金额
- 累计退款金额 ≤ 原交易金额（防止超额退款）
- 部分退款：需记录已退金额，剩余可退金额
\`\`\`
// 退款前校验
remainingRefundable = originalAmount - totalRefunded
if (refundAmount > remainingRefundable):
    throw new Error("PAY_BUSINESS_REFUND_EXCEEDED")
\`\`\`

### 退款状态机
\`\`\`
PENDING → PROCESSING → SUCCEEDED
                    ↘ FAILED → (可重试)
\`\`\`

### 跨境退款注意事项
- 退款汇率：通常按原交易汇率，部分渠道按退款当日汇率
- 币种：必须退回原支付货币（不支持跨币种退款）
- 巴西 PIX：退款通过 Devolução 接口，90天内

### 退款记录必须包含
- 原交易 ID（orderId / chargeId）
- 退款原因码
- 操作人信息
- 申请时间 + 完成时间
- 退款渠道流水号
`,
  },
];

export async function initializeTemplates(store: RuleStore): Promise<void> {
  store.ensureRulesDir();

  let count = 0;
  for (const tmpl of TEMPLATES) {
    const existing = store.getRule(tmpl.id);
    if (existing) { continue; }

    const now = new Date().toISOString();
    const rule = {
      ...tmpl,
      category: tmpl.category as import('./types').RuleCategory,
      filePath: '',
      createdAt: now,
      updatedAt: now,
    };
    await store.saveRule(rule);
    count++;
  }

  await store.loadAll();
}
