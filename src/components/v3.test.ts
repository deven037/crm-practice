import { describe, expect, it } from 'vitest';
import { countAt, originFromLastClick } from './v3';

describe('countAt', () => {
  it('starts at the old value and ends exactly on the new one', () => {
    expect(countAt(0, 250, 0)).toBe(0);
    expect(countAt(0, 250, 1)).toBe(250);
    expect(countAt(40, 10, 1)).toBe(10);
  });

  it('never overshoots, even when a frame arrives late', () => {
    expect(countAt(0, 250, 1.7)).toBe(250);
    expect(countAt(0, 250, -0.2)).toBe(0);
  });

  it('slows down as it arrives', () => {
    const early = countAt(0, 100, 0.2) - countAt(0, 100, 0.1);
    const late = countAt(0, 100, 0.9) - countAt(0, 100, 0.8);
    expect(early).toBeGreaterThan(late);
  });
});

describe('originFromLastClick', () => {
  const box = { left: 100, top: 50 } as DOMRect;

  it('places the origin at the click, measured inside the dialog', () => {
    expect(originFromLastClick(box, 1000, { x: 340, y: 90, at: 900 })).toEqual({ '--from-x': '240px', '--from-y': '40px' });
  });

  it('uses the centre when the dialog was not opened by a recent click', () => {
    expect(originFromLastClick(box, 5000, { x: 340, y: 90, at: 900 })).toEqual({});
    expect(originFromLastClick(box, 1000, null)).toEqual({});
    expect(originFromLastClick(undefined, 1000, { x: 1, y: 1, at: 999 })).toEqual({});
  });
});
