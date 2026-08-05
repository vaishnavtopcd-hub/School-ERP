import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type AppConfig } from '@/config';

export interface PasswordResetMail {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * Outbound email.
 *
 * This is a deliberate stub: it logs instead of sending, so the auth flows are
 * fully exercisable without an SMTP account. Swap the body of `send` for a real
 * provider (SES, Postmark, SendGrid, nodemailer) — the call sites do not change.
 *
 * In production the log line is suppressed, so a misconfigured deployment fails
 * loudly rather than quietly printing reset links into the log stream.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    const { isProduction } = this.config.get('app', { infer: true });

    if (isProduction) {
      this.logger.warn(
        `MailService is a stub — no password reset email was delivered to ${this.mask(mail.to)}. ` +
          'Wire a real provider before relying on password recovery.',
      );
      return;
    }

    this.logger.log(
      `[DEV] Password reset for ${mail.to} (valid ${mail.expiresInMinutes}m): ${mail.resetUrl}`,
    );

    return Promise.resolve();
  }

  /** `a***@example.com` — enough to identify, not enough to harvest. */
  private mask(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }
}
