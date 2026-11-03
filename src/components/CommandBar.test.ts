import { describe, expect, it } from 'vitest';
import { isCloseKey } from './CommandBar';

describe('CommandBar', () => {
  it('closes on Escape and ignores other keys', () => {
    expect(isCloseKey('Escape')).toBe(true);
    expect(isCloseKey('Enter')).toBe(false);
    expect(isCloseKey('Tab')).toBe(false);
  });
});
