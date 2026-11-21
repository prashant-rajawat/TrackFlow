import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../../server/src/validators/auth.validator';

describe('Frontend & Shared Form Validation Contracts', () => {
  it('validates correct registration inputs', () => {
    const valid = {
      fullName: 'Dev Lead',
      email: 'lead@trackflow.dev',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
    };
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects registration when confirmPassword does not match', () => {
    const invalid = {
      fullName: 'Dev Lead',
      email: 'lead@trackflow.dev',
      password: 'StrongPassword123',
      confirmPassword: 'MismatchPassword123',
    };
    const result = registerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors;
      expect(issues[0].message).toBe('Passwords do not match');
    }
  });

  it('rejects passwords shorter than 8 characters', () => {
    const invalid = {
      fullName: 'Dev Lead',
      email: 'lead@trackflow.dev',
      password: 'Short1',
      confirmPassword: 'Short1',
    };
    const result = registerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates correct login credentials', () => {
    const valid = {
      email: 'lead@trackflow.dev',
      password: 'SecretPassword',
    };
    const result = loginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email formats', () => {
    const invalid = {
      email: 'not-an-email',
      password: 'SecretPassword',
    };
    const result = loginSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
