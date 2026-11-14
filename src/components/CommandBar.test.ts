import { describe, expect, it, vi } from 'vitest';
import { consumeEnter, isCloseKey } from './CommandBar';

describe('CommandBar', () => {
  it('closes on Escape and ignores other keys', () => {
    expect(isCloseKey('Escape')).toBe(true);
    expect(isCloseKey('Enter')).toBe(false);
    expect(isCloseKey('Tab')).toBe(false);
  });

  it('cancels the default action of Enter so the refocused opener is not clicked', () => {
    const preventDefault = vi.fn();
    expect(consumeEnter({ key: 'Enter', preventDefault })).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('leaves other keys alone', () => {
    const preventDefault = vi.fn();
    expect(consumeEnter({ key: 'a', preventDefault })).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
