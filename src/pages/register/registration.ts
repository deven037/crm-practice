import { BankType, Registration } from '../../data/frontDoor';
import { passwordProblem } from '../../data/frontDoor';
import { EMAIL_PATTERN } from '../loginValidation';

/**
 * A bank registration while it is being filled in. Everything is kept as the person
 * typed it (numbers as text), so a half-finished form can be saved and reopened.
 * The password is never part of a saved draft.
 */
export interface Draft {
  legalName: string;
  displayName: string;
  bankType: BankType | '';
  registrationNumber: string;
  country: string;
  address: string;
  website: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  logo: string;
  loginImage: string;
  brandColor: string;
  emailDomains: string[];
  currency: string;
  locale: string;
  timezone: string;
  branches: string;
  expectedUsers: string;
  sampleData: boolean;
  adminName: string;
  adminEmail: string;
}

export const STEPS = [
  { id: 'bank', title: 'Bank details', blurb: 'Who the bank is' },
  { id: 'contact', title: 'Contact', blurb: 'Where to reach you' },
  { id: 'branding', title: 'Branding', blurb: 'Logo, picture and colour' },
  { id: 'setup', title: 'Setup', blurb: 'Sign-in and region' },
  { id: 'admin', title: 'First admin', blurb: 'Who runs the CRM' },
  { id: 'review', title: 'Review', blurb: 'Check and submit' },
] as const;
export type StepId = (typeof STEPS)[number]['id'];

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function emptyDraft(): Draft {
  return {
    legalName: '', displayName: '', bankType: '', registrationNumber: '', country: '',
    address: '', website: '', contactName: '', contactPhone: '', contactEmail: '',
    logo: '', loginImage: '', brandColor: '#1d3a6e',
    emailDomains: [], currency: '', locale: 'en-US', timezone: deviceTimezone(), branches: '1', expectedUsers: '10', sampleData: true,
    adminName: '', adminEmail: '',
  };
}

// ---------- validation: the same rules the server applies (server/src/schemas/bank.ts) ----------

const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com',
  'gmx.com', 'rediffmail.com',
]);

export const emailDomain = (email: string) => email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase();

/** Why a typed value cannot be one of the bank's email domains; null when it can. */
export function domainProblem(value: string): string | null {
  const domain = cleanDomain(value);
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return 'Enter a domain like yourbank.com.';
  if (PUBLIC_MAIL_DOMAINS.has(domain)) return 'Use your bank\'s own email domain, not a public mail service.';
  return null;
}

/** People paste all sorts of things: "@Axisbank.com", "https://axisbank.com/", "name@axisbank.com". */
export function cleanDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/^.*@/, '');
}

function wholeNumber(value: string, max: number): boolean {
  return /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= max;
}

export type Problems = Partial<Record<keyof Draft | 'password' | 'confirm', string>>;

/** What still has to be fixed on one step. Empty: the step is complete. */
export function stepProblems(step: StepId, draft: Draft, password = '', confirm = ''): Problems {
  const p: Problems = {};
  const need = (key: keyof Draft, label: string, max = 200) => {
    const value = String(draft[key]).trim();
    if (!value) p[key] = `${label} is required.`;
    else if (value.length > max) p[key] = `${label} is too long (${max} characters at most).`;
  };

  if (step === 'bank') {
    need('legalName', 'Legal name');
    need('displayName', 'Bank name', 80);
    if (!draft.bankType) p.bankType = 'Choose the type of bank.';
    need('registrationNumber', 'Licence or registration number', 60);
    if (!draft.country) p.country = 'Choose a country.';
  }
  if (step === 'contact') {
    need('address', 'Head office address', 400);
    if (draft.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(draft.website.trim())) p.website = 'Enter a full web address, starting with https://';
    need('contactName', 'Contact person', 120);
    if (!/^[+0-9 ()-]{6,24}$/.test(draft.contactPhone.trim())) p.contactPhone = 'Enter a phone number.';
    if (!EMAIL_PATTERN.test(draft.contactEmail.trim())) p.contactEmail = 'Enter a valid email address.';
  }
  if (step === 'branding') {
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.brandColor.trim())) p.brandColor = 'Choose a colour.';
  }
  if (step === 'setup') {
    if (draft.emailDomains.length === 0) p.emailDomains = 'Add at least one email domain.';
    else if (draft.emailDomains.length > 5) p.emailDomains = 'Five email domains at most.';
    if (!draft.currency) p.currency = 'Choose a currency.';
    if (!draft.locale) p.locale = 'Choose a language and region.';
    if (!draft.timezone) p.timezone = 'Choose a timezone.';
    if (!wholeNumber(draft.branches, 100000)) p.branches = 'Enter how many branches the bank has.';
    if (!wholeNumber(draft.expectedUsers, 1000000)) p.expectedUsers = 'Enter how many people will use the CRM.';
  }
  if (step === 'admin') {
    need('adminName', 'Your name', 120);
    if (!EMAIL_PATTERN.test(draft.adminEmail.trim())) p.adminEmail = 'Enter a valid email address.';
    else if (!draft.emailDomains.includes(emailDomain(draft.adminEmail))) {
      p.adminEmail = `The admin's email must be on one of the bank's email domains (${draft.emailDomains.join(', ') || 'add one in Setup'}).`;
    }
    const rule = passwordProblem(password);
    if (rule) p.password = rule;
    if (confirm !== password) p.confirm = 'The two passwords do not match.';
  }
  return p;
}

/** The first step that still has something to fix, or null when the registration can be sent. */
export function firstIncompleteStep(draft: Draft, password: string, confirm: string): StepId | null {
  for (const step of STEPS) {
    if (step.id !== 'review' && Object.keys(stepProblems(step.id, draft, password, confirm)).length) return step.id;
  }
  return null;
}

/** The finished form in the shape the API takes. */
export function toRegistration(draft: Draft, password: string): Registration {
  return {
    legalName: draft.legalName.trim(),
    displayName: draft.displayName.trim(),
    bankType: draft.bankType as BankType,
    registrationNumber: draft.registrationNumber.trim(),
    country: draft.country,
    address: draft.address.trim(),
    website: draft.website.trim(),
    contactName: draft.contactName.trim(),
    contactPhone: draft.contactPhone.trim(),
    contactEmail: draft.contactEmail.trim(),
    emailDomains: draft.emailDomains,
    currency: draft.currency,
    locale: draft.locale,
    timezone: draft.timezone,
    brandColor: draft.brandColor.trim().toLowerCase(),
    branches: Number(draft.branches),
    expectedUsers: Number(draft.expectedUsers),
    sampleData: draft.sampleData,
    admin: { name: draft.adminName.trim(), email: draft.adminEmail.trim().toLowerCase(), password },
    ...(draft.logo ? { logo: draft.logo } : {}),
    ...(draft.loginImage ? { loginImage: draft.loginImage } : {}),
  };
}

/** Which step a field the server rejected belongs to, so the form can take the person there. */
export function stepOfField(field: string): StepId {
  const name = field.split('.')[0];
  if (['legalName', 'displayName', 'bankType', 'registrationNumber', 'country'].includes(name)) return 'bank';
  if (['address', 'website', 'contactName', 'contactPhone', 'contactEmail'].includes(name)) return 'contact';
  if (['logo', 'loginImage', 'brandColor'].includes(name)) return 'branding';
  if (name === 'admin') return 'admin';
  return 'setup';
}

// ---------- save and continue later ----------

const DRAFT_KEY = 'crm.registerDraft';
const SENT_KEY = 'crm.registration';

interface SavedDraft {
  draft: Draft;
  step: StepId;
  savedAt: string;
  /** False when the pictures were too big to keep on this device and must be chosen again. */
  imagesKept: boolean;
}

export function saveDraft(draft: Draft, step: StepId, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  const savedAt = new Date().toISOString();
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify({ draft, step, savedAt, imagesKept: true } satisfies SavedDraft));
    return true;
  } catch {
    // Usually the pictures: browsers keep about 5 MB per site. Save everything else.
    try {
      storage.setItem(DRAFT_KEY, JSON.stringify({ draft: { ...draft, logo: '', loginImage: '' }, step, savedAt, imagesKept: false } satisfies SavedDraft));
    } catch {
      /* storage is unavailable: nothing is saved, the form still works */
    }
    return false;
  }
}

export function loadDraft(storage: Pick<Storage, 'getItem'> = localStorage): SavedDraft | null {
  try {
    const saved = JSON.parse(storage.getItem(DRAFT_KEY) ?? 'null') as SavedDraft | null;
    if (!saved?.draft || !STEPS.some((s) => s.id === saved.step)) return null;
    // A draft from an older version of the form may lack newer fields.
    return { ...saved, draft: { ...emptyDraft(), ...saved.draft } };
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The admin email of the registration sent from this device, so its status page opens directly. */
export function rememberSent(email: string | null) {
  try {
    if (email) localStorage.setItem(SENT_KEY, email);
    else localStorage.removeItem(SENT_KEY);
  } catch {
    /* not remembered */
  }
}

export function sentEmail(): string {
  try {
    return localStorage.getItem(SENT_KEY) ?? '';
  } catch {
    return '';
  }
}

// ---------- choices ----------

const COUNTRY_CODES =
  'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW'.split(' ');

export interface Choice {
  value: string;
  label: string;
}

function names(type: 'region' | 'currency') {
  try {
    return new Intl.DisplayNames(['en'], { type });
  } catch {
    return null;
  }
}

export function countryChoices(): Choice[] {
  const display = names('region');
  return COUNTRY_CODES.map((code) => ({ value: code, label: display?.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label));
}

export const countryName = (code: string) => (code ? names('region')?.of(code) ?? code : '');

function supported(kind: 'currency' | 'timeZone', fallback: string[]): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (kind: string) => string[] };
  try {
    return intl.supportedValuesOf?.(kind) ?? fallback;
  } catch {
    return fallback;
  }
}

export function currencyChoices(): Choice[] {
  const display = names('currency');
  return supported('currency', ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'ZAR']).map((code) => ({
    value: code,
    label: `${code} · ${display?.of(code) ?? code}`,
  }));
}

export function timezoneChoices(): Choice[] {
  const zones = supported('timeZone', ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York']);
  return [...new Set(['UTC', ...zones])].map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }));
}

export const LOCALE_CHOICES: Choice[] = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-SG', label: 'English (Singapore)' },
  { value: 'en-ZA', label: 'English (South Africa)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
  { value: 'ar-AE', label: 'Arabic (United Arab Emirates)' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'id-ID', label: 'Indonesian (Indonesia)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
];

/** The currency most banks in a country use, to save a choice. Only a starting point. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SG: 'SGD', AU: 'AUD', CA: 'CAD', JP: 'JPY', ZA: 'ZAR', SA: 'SAR', DE: 'EUR', FR: 'EUR',
  ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', BR: 'BRL', MX: 'MXN', ID: 'IDR', MY: 'MYR', NG: 'NGN', KE: 'KES', BD: 'BDT', LK: 'LKR', NP: 'NPR',
  PK: 'PKR', PH: 'PHP', TH: 'THB', VN: 'VND', CH: 'CHF', NZ: 'NZD', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', EG: 'EGP', TR: 'TRY',
};

export const BRAND_PRESETS = ['#1d3a6e', '#97144d', '#0f766e', '#b45309', '#6d28d9', '#be123c', '#0369a1', '#15803d', '#f2b705', '#111827'];
