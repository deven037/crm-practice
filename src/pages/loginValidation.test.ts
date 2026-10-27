import { describe, expect, it } from 'vitest';
import { EMAIL_PATTERN, RESET_UNAVAILABLE_MESSAGE } from './loginValidation';

describe('EMAIL_PATTERN', () => {
  it.each([
    'user@example.com',
    'first.last@example.co.uk',
    'user+tag@example.com',
    'a@b.c',
  ])('accepts %s', (email) => {
    expect(EMAIL_PATTERN.test(email)).toBe(true);
  });

  it.each([
    '',
    'user',
    'user@',
    '@example.com',
    'user@example',
    'user@example.',
    'user@@example.com',
    'user name@example.com',
    'user@exa mple.com',
    ' user@example.com',
    'user@example.com ',
  ])('rejects %j', (email) => {
    expect(EMAIL_PATTERN.test(email)).toBe(false);
  });
});

describe('RESET_UNAVAILABLE_MESSAGE', () => {
  it('is a non-empty string', () => {
    expect(typeof RESET_UNAVAILABLE_MESSAGE).toBe('string');
    expect(RESET_UNAVAILABLE_MESSAGE.trim().length).toBeGreaterThan(0);
  });

  it('does not claim a reset email was sent', () => {
    expect(RESET_UNAVAILABLE_MESSAGE.toLowerCase()).toContain('unavailable');
  });
});
