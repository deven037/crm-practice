import { describe, expect, it } from 'vitest';
import { bankTheme, contrast, HARBOR_COLOR, parseHex } from './bankTheme';

describe('bankTheme', () => {
  it('falls back to the Harbor colour when the bank has none or it is not a colour', () => {
    expect(bankTheme(null).primary).toBe(HARBOR_COLOR);
    expect(bankTheme('').primary).toBe(HARBOR_COLOR);
    expect(bankTheme('red').primary).toBe(HARBOR_COLOR);
  });

  it('puts white text on a dark bank colour and dark text on a light one', () => {
    expect(bankTheme('#1d3a6e').on).toBe('#ffffff');
    expect(bankTheme('#f2b705').on).toBe('#14110a');
  });

  it.each(['#1d3a6e', '#f2b705', '#97144d', '#00a651', '#ffffff', '#000000', '#7dd3fc', '#ff6b00'])(
    'keeps %s readable as text on both pages and under its own label',
    (color) => {
      const theme = bankTheme(color);
      expect(contrast(theme.on, theme.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.inkLight, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.inkDark, '#171c28')).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('leaves a colour that is already readable untouched', () => {
    expect(bankTheme('#1d3a6e').inkLight).toBe('#1d3a6e');
  });

  it('reads six-digit hex only', () => {
    expect(parseHex('#fff')).toBeNull();
    expect(parseHex('97144d')).toEqual([0x97, 0x14, 0x4d]);
  });
});
