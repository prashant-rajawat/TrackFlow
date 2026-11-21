import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCanonicalClientUrl, isAiStudioProxyUrl } from '../../server/src/utils/url.util.js';
import { EmailService } from '../../server/src/services/email.service.js';

describe('Invitation System Production Fixes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    EmailService.clearSentEmailsLog();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('URL Utility & AI Studio Proxy Rejection', () => {
    it('detects AI Studio proxy and auth-bridge URLs correctly', () => {
      expect(isAiStudioProxyUrl('https://aistudio.google.com/applet-auth-bridge/xyz')).toBe(true);
      expect(isAiStudioProxyUrl('https://xyz.googleusercontent.com/abc')).toBe(true);
      expect(isAiStudioProxyUrl('http://localhost:3000')).toBe(false);
      expect(isAiStudioProxyUrl('https://trackflow.app')).toBe(false);
    });

    it('rejects AI Studio proxy URL in CLIENT_URL env and falls back safely', () => {
      process.env.CLIENT_URL = 'https://aistudio.google.com/applet-auth-bridge/token';
      const canonical = getCanonicalClientUrl();
      expect(canonical).not.toContain('aistudio.google.com');
      expect(canonical).toBe('http://localhost:3000');
    });

    it('uses valid CLIENT_URL when provided', () => {
      process.env.CLIENT_URL = 'https://trackflow.production.app';
      const canonical = getCanonicalClientUrl();
      expect(canonical).toBe('https://trackflow.production.app');
    });
  });

  describe('Email Service Delivery', () => {
    it('delivers email successfully with dev fallback and logs sent emails', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SMTP_HOST;

      const result = await EmailService.sendInvitationEmail(
        'test@example.com',
        'Acme Workspace',
        'Alice Smith',
        'MEMBER',
        'http://localhost:3000/invite/token123'
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('dev_fallback');

      const log = EmailService.getSentEmailsLog();
      expect(log.length).toBe(1);
      expect(log[0].to).toBe('test@example.com');
      expect(log[0].subject).toContain('Acme Workspace');
      expect(log[0].html).toContain('http://localhost:3000/invite/token123');
    });
  });
});
