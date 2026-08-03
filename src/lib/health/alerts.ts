/**
 * 告警通道抽象（L5 运维层）
 *
 * 职责：统一告警发送接口，当前支持控制台 + Webhook（钉钉/企业微信/Slack 兼容）。
 * 预留：邮件通道（后续接入 nodemailer 或 SMTP 配置）。
 *
 * 约束：告警发送失败不影响主流程（fail-soft）；不暴露敏感信息。
 */

// ============================================================
// 类型定义
// ============================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertMessage {
  /** 告警标题（如 "系统健康异常"） */
  title: string;
  /** 告警详情 */
  detail: string;
  /** 严重级别 */
  severity: AlertSeverity;
  /** 来源模块（health-check / worker / system） */
  source: string;
  /** 附加数据（如检查项明细） */
  data?: Record<string, unknown>;
  /** 时间戳 */
  timestamp?: string;
}

export interface AlertChannel {
  readonly id: string;
  readonly name: string;
  /** 发送告警；返回是否成功 */
  send(message: AlertMessage): Promise<boolean>;
  /** 是否已配置启用 */
  isConfigured(): boolean;
}

// ============================================================
// 控制台通道（始终可用，开发/兜底）
// ============================================================

export class ConsoleAlertChannel implements AlertChannel {
  readonly id = 'console';
  readonly name = '控制台';

  isConfigured(): boolean {
    return true;
  }

  async send(message: AlertMessage): Promise<boolean> {
    const ts = message.timestamp ?? new Date().toISOString();
    const tag = `[ALERT:${message.severity.toUpperCase()}]`;
    if (message.severity === 'critical') {
      console.error(`${tag} ${ts} ${message.source} | ${message.title} | ${message.detail}`);
    } else if (message.severity === 'warning') {
      console.warn(`${tag} ${ts} ${message.source} | ${message.title} | ${message.detail}`);
    } else {
      console.info(`${tag} ${ts} ${message.source} | ${message.title} | ${message.detail}`);
    }
    return true;
  }
}

// ============================================================
// Webhook 通道（钉钉/企业微信/Slack 兼容）
// ============================================================

export class WebhookAlertChannel implements AlertChannel {
  readonly id = 'webhook';
  readonly name = 'Webhook（钉钉/企微/Slack）';

  private url: string;

  constructor() {
    this.url = process.env.ALERT_WEBHOOK_URL || '';
  }

  isConfigured(): boolean {
    return this.url.length > 20;
  }

  async send(message: AlertMessage): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const ts = message.timestamp ?? new Date().toISOString();
      // 钉钉/企微机器人兼容格式（markdown）
      const payload = {
        msgtype: 'markdown',
        markdown: {
          title: `[${message.severity.toUpperCase()}] ${message.title}`,
          text: [
            `### ${message.title}`,
            `- **级别**: ${message.severity}`,
            `- **来源**: ${message.source}`,
            `- **时间**: ${ts}`,
            `- **详情**: ${message.detail}`,
            message.data ? `- **数据**: \`${JSON.stringify(message.data).slice(0, 500)}\`` : '',
          ].join('\n'),
        },
      };
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================
// 邮件通道（预留，未实现发送，仅占位）
// ============================================================

export class EmailAlertChannel implements AlertChannel {
  readonly id = 'email';
  readonly name = '邮件';

  isConfigured(): boolean {
    // 预留：配置 SMTP_HOST + SMTP_USER + ALERT_EMAIL 后启用
    return Boolean(process.env.SMTP_HOST && process.env.ALERT_EMAIL);
  }

  async send(_message: AlertMessage): Promise<boolean> {
    // TODO: 接入 nodemailer 或自建 SMTP 发送
    // 当前为占位实现，避免未配置时误报成功
    return false;
  }
}

// ============================================================
// 告警管理器（聚合所有已配置通道）
// ============================================================

class AlertManager {
  private channels: AlertChannel[];

  constructor() {
    this.channels = [new ConsoleAlertChannel(), new WebhookAlertChannel(), new EmailAlertChannel()];
  }

  /** 发送告警到所有已配置通道 */
  async send(message: AlertMessage): Promise<{ sent: number; failed: number }> {
    const msg: AlertMessage = { ...message, timestamp: message.timestamp ?? new Date().toISOString() };
    const results = await Promise.all(
      this.channels.filter((c) => c.isConfigured()).map((c) => c.send(msg))
    );
    return {
      sent: results.filter(Boolean).length,
      failed: results.filter((r) => !r).length,
    };
  }

  /** 当前已配置的通道列表 */
  configuredChannels(): string[] {
    return this.channels.filter((c) => c.isConfigured()).map((c) => c.id);
  }
}

/** 全局告警管理器单例 */
export const alertManager = new AlertManager();

/** 便捷函数：发送一条告警 */
export async function sendAlert(
  title: string,
  detail: string,
  severity: AlertSeverity = 'warning',
  source = 'system',
  data?: Record<string, unknown>
) {
  return alertManager.send({ title, detail, severity, source, data });
}
