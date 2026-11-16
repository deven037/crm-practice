import { ApiError, apiFetch, BASE_URL, readError } from './apiFetch';

/** What anyone may know about a bank: enough to draw its sign-in page. */
export interface PublicBank {
  id: string;
  name: string;
  status: BankStatus;
  color: string | null;
  logoUrl: string | null;
  loginImageUrl: string | null;
}

export type BankStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export const BANK_TYPES = [
  { value: 'commercial', label: 'Commercial bank' },
  { value: 'cooperative', label: 'Co-operative bank' },
  { value: 'small_finance', label: 'Small finance bank' },
  { value: 'nbfc', label: 'NBFC' },
  { value: 'other', label: 'Other' },
] as const;
export type BankType = (typeof BANK_TYPES)[number]['value'];

/** Everything a bank tells the platform about itself. Mirrors the server's bankProfileSchema. */
export interface BankProfile {
  displayName: string;
  legalName: string;
  bankType: BankType;
  registrationNumber: string;
  country: string;
  address: string;
  website: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  emailDomains: string[];
  currency: string;
  locale: string;
  timezone: string;
  brandColor: string;
  branches: number;
  expectedUsers: number;
  sampleData: boolean;
}

// ---------- sign-in ----------

/** Step one of sign-in: which bank does this email's domain belong to? */
export async function identify(email: string): Promise<PublicBank[]> {
  const { banks } = await apiFetch<{ banks: PublicBank[] }>('/auth/identify', { method: 'POST', body: JSON.stringify({ email }) });
  return banks;
}

const BANK_KEY = 'crm.bank';

/** The bank this device signed in to last, so its branded page opens directly next time. */
export function rememberedBank(): PublicBank | null {
  try {
    const bank = JSON.parse(localStorage.getItem(BANK_KEY) ?? 'null');
    return bank && typeof bank.id === 'string' && typeof bank.name === 'string' ? bank : null;
  } catch {
    return null;
  }
}

export function rememberBank(bank: PublicBank | null) {
  try {
    if (bank) localStorage.setItem(BANK_KEY, JSON.stringify(bank));
    else localStorage.removeItem(BANK_KEY);
  } catch {
    /* private mode: the bank simply is not remembered */
  }
}

export interface Invite {
  name: string;
  email: string;
  bank: PublicBank;
}

export const readInvite = (token: string) => apiFetch<Invite>(`/auth/invite?token=${encodeURIComponent(token)}`);

/** The password rule, the same one the server enforces. Null when the password is fine. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) return 'Password must contain a letter and a number.';
  return null;
}

// ---------- registration ----------

export interface Registration extends BankProfile {
  admin: { name: string; email: string; password: string };
  logo?: string;
  loginImage?: string;
}

export interface RegistrationStatus {
  name: string;
  status: BankStatus;
  reason: string | null;
  registeredAt: string;
  decidedAt: string | null;
}

export const registerBank = (registration: Registration) =>
  apiFetch<{ id: string; name: string; status: BankStatus }>('/platform/banks', { method: 'POST', body: JSON.stringify(registration) });

export const registrationStatus = (email: string) =>
  apiFetch<RegistrationStatus>(`/platform/registration-status?email=${encodeURIComponent(email)}`);

export const IMAGE_LIMITS = { logo: 1024 * 1024, login: 3 * 1024 * 1024 } as const;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Why a chosen file cannot be used as a logo or login image; null when it can. */
export function imageProblem(file: { type: string; size: number }, kind: keyof typeof IMAGE_LIMITS): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Choose a PNG, JPEG or WebP image.';
  if (file.size > IMAGE_LIMITS[kind]) return `The image is too large. The limit is ${IMAGE_LIMITS[kind] / (1024 * 1024)} MB.`;
  return null;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

// ---------- the signed-in bank's own settings ----------

export interface OwnBank extends PublicBank {
  displayName: string;
  profile: Omit<BankProfile, 'displayName' | 'website'> & { website?: string };
}

export const fetchOwnBank = () => apiFetch<OwnBank>('/bank');
export const saveOwnBank = (profile: BankProfile) => apiFetch<OwnBank>('/bank/profile', { method: 'PUT', body: JSON.stringify(profile) });
export const saveBankImage = (kind: 'logo' | 'login', image: string) =>
  apiFetch<PublicBank>(`/bank/assets/${kind}`, { method: 'PUT', body: JSON.stringify({ image }) });
export const removeBankImage = (kind: 'logo' | 'login') => apiFetch<void>(`/bank/assets/${kind}`, { method: 'DELETE' });

// ---------- platform owner console ----------

const PLATFORM_KEY = 'crm.platformToken';
export const getPlatformToken = () => sessionStorage.getItem(PLATFORM_KEY);
export const clearPlatformToken = () => sessionStorage.removeItem(PLATFORM_KEY);

/** A bank as the platform console sees it. */
export interface ConsoleBank {
  id: string;
  displayName: string;
  status: BankStatus;
  statusReason: string | null;
  adminEmail: string;
  profile: Omit<BankProfile, 'displayName' | 'website'> & { website?: string };
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  assets: Partial<Record<'logo' | 'login', string>>;
  users: number;
  records: number;
}

async function platformRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getPlatformToken();
  const res = await fetch(`${BASE_URL}/api/platform${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const error = await readError(res);
    // The console session ended: forget it, so the page shows the sign-in again.
    if (token && (res.status === 401 || res.status === 403)) clearPlatformToken();
    throw error;
  }
  return res;
}

async function platformFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await platformRequest(path, options);
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function platformLogin(email: string, password: string): Promise<{ name: string; email: string }> {
  clearPlatformToken();
  const { token, admin } = await platformFetch<{ token: string; admin: { name: string; email: string } }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  sessionStorage.setItem(PLATFORM_KEY, token);
  return admin;
}

export const platformBanks = async () => (await platformFetch<{ data: ConsoleBank[] }>('/banks')).data;

export type BankAction = 'approve' | 'reject' | 'suspend' | 'reactivate';
export const decideBank = (id: string, action: BankAction, reason?: string) =>
  platformFetch<ConsoleBank>(`/banks/${id}/${action}`, { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) });
export const deleteBank = (id: string) => platformFetch<void>(`/banks/${id}`, { method: 'DELETE' });

/** A pending bank's images are not public yet, so the console fetches them with its own token. */
export async function platformBankImage(id: string, kind: 'logo' | 'login'): Promise<string> {
  const res = await platformRequest(`/banks/${id}/assets/${kind}`);
  return URL.createObjectURL(await res.blob());
}

export { ApiError };
