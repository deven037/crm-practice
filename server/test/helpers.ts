import { prepare } from '../src/app.js';
import { DEMO_BANK_ID } from '../src/banks.js';
import { setFallbackBankStore } from '../src/context.js';
import { signToken } from '../src/middleware/auth.js';
import { getBankStore } from '../src/tenancy.js';
import { Role } from '../src/types.js';

/** The demo bank's seeded users, one per role. */
const DEMO_USER: Record<Role, { id: string; name: string; email: string }> = {
  admin: { id: 'user-1', name: 'Alex Admin', email: 'admin@crm.com' },
  rep: { id: 'user-2', name: 'Riya Rep', email: 'rep@crm.com' },
  viewer: { id: 'user-3', name: 'Vik Viewer', email: 'viewer@crm.com' },
};

/**
 * Starts the database with the demo bank and lets test set-up code use `store`
 * outside a request (it then means the demo bank's data).
 */
export async function useDemoBank(): Promise<void> {
  await prepare();
  const bankStore = await getBankStore(DEMO_BANK_ID);
  setFallbackBankStore(DEMO_BANK_ID, bankStore.store);
}

export const demoToken = (role: Role) => signToken({ ...DEMO_USER[role], role }, DEMO_BANK_ID);
