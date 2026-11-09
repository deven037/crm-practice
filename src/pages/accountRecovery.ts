export interface RecoveryHooks {
  setBusy: (busy: boolean) => void;
  setError: (failed: boolean) => void;
}

// Runs a save or delete. On rejection it shows the error, re-enables the buttons and returns false.
export async function runRecoverable(action: () => Promise<unknown>, hooks: RecoveryHooks): Promise<boolean> {
  hooks.setBusy(true);
  hooks.setError(false);
  try {
    await action();
    return true;
  } catch {
    hooks.setError(true);
    hooks.setBusy(false);
    return false;
  }
}
