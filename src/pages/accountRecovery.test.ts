import { describe, expect, it } from 'vitest';
import { runRecoverable } from './accountRecovery';

function hooks() {
  const calls: string[] = [];
  return {
    calls,
    hooks: {
      setBusy: (busy: boolean) => calls.push(`busy:${busy}`),
      setError: (failed: boolean) => calls.push(`error:${failed}`),
    },
  };
}

describe('runRecoverable', () => {
  it('keeps the form busy and returns true when the save succeeds', async () => {
    const { calls, hooks: h } = hooks();

    const ok = await runRecoverable(async () => undefined, h);

    expect(ok).toBe(true);
    expect(calls).toEqual(['busy:true', 'error:false']);
  });

  it('shows the error and re-enables the buttons when the save is rejected', async () => {
    const { calls, hooks: h } = hooks();

    const ok = await runRecoverable(async () => {
      throw new Error('500');
    }, h);

    expect(ok).toBe(false);
    expect(calls).toEqual(['busy:true', 'error:false', 'error:true', 'busy:false']);
  });

  it('clears an earlier error on retry and succeeds', async () => {
    const { calls, hooks: h } = hooks();
    let attempt = 0;
    const action = async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('409');
    };

    expect(await runRecoverable(action, h)).toBe(false);
    expect(await runRecoverable(action, h)).toBe(true);
    expect(calls.slice(-2)).toEqual(['busy:true', 'error:false']);
  });
});
