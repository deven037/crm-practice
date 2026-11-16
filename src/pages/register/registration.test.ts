import { describe, expect, it } from 'vitest';
import {
  cleanDomain, domainProblem, Draft, emailDomain, emptyDraft, firstIncompleteStep, loadDraft, saveDraft, stepOfField, stepProblems, toRegistration,
} from './registration';

const PASSWORD = 'Harbor-2026';

/** A registration with every step filled in correctly. */
function complete(over: Partial<Draft> = {}): Draft {
  return {
    ...emptyDraft(),
    legalName: 'Axis Bank Limited', displayName: 'Axis Bank', bankType: 'commercial', registrationNumber: 'L65110GJ1993', country: 'IN',
    address: '1 Bank Street, Mumbai', website: 'https://axisbank.com', contactName: 'Asha Rao', contactPhone: '+91 22 5550 0100', contactEmail: 'office@axisbank.com',
    emailDomains: ['axisbank.com'], currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata', branches: '40', expectedUsers: '250',
    adminName: 'Asha Rao', adminEmail: 'asha@axisbank.com',
    ...over,
  };
}

describe('email domains', () => {
  it('reads the domain from what people paste', () => {
    expect(cleanDomain(' @Axisbank.com ')).toBe('axisbank.com');
    expect(cleanDomain('https://www.axisbank.com/about')).toBe('axisbank.com');
    expect(cleanDomain('asha@axisbank.com')).toBe('axisbank.com');
    expect(emailDomain('Asha@AxisBank.com ')).toBe('axisbank.com');
  });

  it('accepts a bank domain', () => {
    expect(domainProblem('axisbank.com')).toBeNull();
    expect(domainProblem('mail.axis-bank.co.in')).toBeNull();
  });

  it('refuses something that is not a domain', () => {
    expect(domainProblem('axisbank')).toMatch(/domain like/);
    expect(domainProblem('-axis.com')).toMatch(/domain like/);
    expect(domainProblem('axis bank.com')).toMatch(/domain like/);
  });

  it('refuses public mail services, however they are typed', () => {
    expect(domainProblem('gmail.com')).toMatch(/public mail/);
    expect(domainProblem('someone@Outlook.com')).toMatch(/public mail/);
  });
});

describe('stepProblems', () => {
  it('finds nothing wrong with a complete registration', () => {
    const draft = complete();
    for (const step of ['bank', 'contact', 'branding', 'setup', 'admin'] as const) {
      expect(stepProblems(step, draft, PASSWORD, PASSWORD)).toEqual({});
    }
  });

  it('asks for every bank detail on an empty form', () => {
    expect(Object.keys(stepProblems('bank', emptyDraft())).sort()).toEqual(['bankType', 'country', 'displayName', 'legalName', 'registrationNumber']);
  });

  it('treats spaces as empty and limits the length', () => {
    expect(stepProblems('bank', complete({ legalName: '   ' })).legalName).toBe('Legal name is required.');
    expect(stepProblems('bank', complete({ displayName: 'x'.repeat(81) })).displayName).toMatch(/too long \(80/);
  });

  it('lets the website stay empty but checks one that is typed', () => {
    expect(stepProblems('contact', complete({ website: '' }))).toEqual({});
    expect(stepProblems('contact', complete({ website: 'axisbank.com' })).website).toMatch(/https/);
  });

  it('checks the contact phone and email', () => {
    const problems = stepProblems('contact', complete({ contactPhone: 'call me', contactEmail: 'office@axisbank' }));
    expect(problems.contactPhone).toBeDefined();
    expect(problems.contactEmail).toBeDefined();
  });

  it('wants a full six-digit colour', () => {
    expect(stepProblems('branding', complete({ brandColor: '#abc' })).brandColor).toBeDefined();
    expect(stepProblems('branding', complete({ brandColor: '#97144D' }))).toEqual({});
  });

  it('wants one to five email domains', () => {
    expect(stepProblems('setup', complete({ emailDomains: [] })).emailDomains).toMatch(/at least one/);
    expect(stepProblems('setup', complete({ emailDomains: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'] })).emailDomains).toMatch(/Five/);
  });

  it('wants whole numbers of branches and users', () => {
    for (const bad of ['', '0', '-3', '2.5', 'ten', '100001']) {
      expect(stepProblems('setup', complete({ branches: bad })).branches, bad).toBeDefined();
    }
    expect(stepProblems('setup', complete({ branches: '100000', expectedUsers: '1000000' }))).toEqual({});
    expect(stepProblems('setup', complete({ expectedUsers: '1000001' })).expectedUsers).toBeDefined();
  });

  it('keeps the first admin on one of the bank\'s email domains', () => {
    const problem = stepProblems('admin', complete({ adminEmail: 'asha@gmail.com' }), PASSWORD, PASSWORD).adminEmail;
    expect(problem).toMatch(/axisbank\.com/);
    expect(stepProblems('admin', complete({ adminEmail: 'Asha@AxisBank.com' }), PASSWORD, PASSWORD)).toEqual({});
  });

  it('applies the password rules and asks for the same password twice', () => {
    expect(stepProblems('admin', complete(), 'short1', 'short1').password).toMatch(/8 characters/);
    expect(stepProblems('admin', complete(), 'onlyletters', 'onlyletters').password).toMatch(/letter and a number/);
    expect(stepProblems('admin', complete(), PASSWORD, 'Harbor-2027').confirm).toMatch(/do not match/);
  });
});

describe('firstIncompleteStep', () => {
  it('is null when the registration can be sent', () => {
    expect(firstIncompleteStep(complete(), PASSWORD, PASSWORD)).toBeNull();
  });

  it('names the earliest step with something to fix', () => {
    expect(firstIncompleteStep(emptyDraft(), '', '')).toBe('bank');
    expect(firstIncompleteStep(complete({ currency: '', adminName: '' }), PASSWORD, PASSWORD)).toBe('setup');
    // A draft reopened later has no password: the admin step is the one left.
    expect(firstIncompleteStep(complete(), '', '')).toBe('admin');
  });
});

describe('toRegistration', () => {
  it('trims text, turns counts into numbers and lowercases what is compared', () => {
    const sent = toRegistration(complete({ legalName: '  Axis Bank Limited ', brandColor: '#97144D', adminEmail: ' Asha@AxisBank.com ', branches: '40' }), PASSWORD);
    expect(sent.legalName).toBe('Axis Bank Limited');
    expect(sent.brandColor).toBe('#97144d');
    expect(sent.branches).toBe(40);
    expect(sent.expectedUsers).toBe(250);
    expect(sent.admin).toEqual({ name: 'Asha Rao', email: 'asha@axisbank.com', password: PASSWORD });
  });

  it('sends pictures only when they were chosen', () => {
    expect(toRegistration(complete(), PASSWORD)).not.toHaveProperty('logo');
    expect(toRegistration(complete(), PASSWORD)).not.toHaveProperty('loginImage');
    expect(toRegistration(complete({ logo: 'data:image/png;base64,AAAA' }), PASSWORD).logo).toBe('data:image/png;base64,AAAA');
  });
});

describe('stepOfField', () => {
  it('takes a field the server rejected back to its step', () => {
    expect(stepOfField('displayName')).toBe('bank');
    expect(stepOfField('contactPhone')).toBe('contact');
    expect(stepOfField('loginImage')).toBe('branding');
    expect(stepOfField('emailDomains.0')).toBe('setup');
    expect(stepOfField('admin.email')).toBe('admin');
    expect(stepOfField('somethingNew')).toBe('setup');
  });
});

describe('save and continue later', () => {
  function memory(limit = Infinity) {
    const kept = new Map<string, string>();
    return {
      kept,
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (value.length > limit) throw new Error('QuotaExceededError');
        kept.set(key, value);
      },
    };
  }

  it('brings back what was typed and the step it was left on', () => {
    const storage = memory();
    expect(saveDraft(complete({ logo: 'data:image/png;base64,AAAA' }), 'setup', storage)).toBe(true);
    const saved = loadDraft(storage)!;
    expect(saved.step).toBe('setup');
    expect(saved.imagesKept).toBe(true);
    expect(saved.draft).toEqual(complete({ logo: 'data:image/png;base64,AAAA' }));
  });

  it('never keeps a password', () => {
    const storage = memory();
    saveDraft(complete(), 'admin', storage);
    expect([...storage.kept.values()].join('')).not.toContain(PASSWORD);
    expect(loadDraft(storage)!.draft).not.toHaveProperty('password');
  });

  it('keeps the answers without the pictures when the pictures do not fit', () => {
    const storage = memory(2000);
    const big = 'data:image/png;base64,' + 'A'.repeat(5000);
    expect(saveDraft(complete({ logo: big, loginImage: big }), 'branding', storage)).toBe(false);
    const saved = loadDraft(storage)!;
    expect(saved.imagesKept).toBe(false);
    expect(saved.draft.logo).toBe('');
    expect(saved.draft.loginImage).toBe('');
    expect(saved.draft.legalName).toBe('Axis Bank Limited');
  });

  it('does not fail when nothing can be stored', () => {
    expect(saveDraft(complete(), 'bank', memory(0))).toBe(false);
  });

  it('fills fields a draft from an older form does not have', () => {
    const storage = memory();
    storage.setItem('crm.registerDraft', JSON.stringify({ draft: { legalName: 'Old Bank' }, step: 'contact', savedAt: '2026-11-01T00:00:00.000Z', imagesKept: true }));
    const saved = loadDraft(storage)!;
    expect(saved.draft.legalName).toBe('Old Bank');
    expect(saved.draft.brandColor).toBe(emptyDraft().brandColor);
    expect(saved.draft.emailDomains).toEqual([]);
  });

  it('ignores a draft it cannot read', () => {
    const storage = memory();
    expect(loadDraft(storage)).toBeNull();
    storage.setItem('crm.registerDraft', '{not json');
    expect(loadDraft(storage)).toBeNull();
    storage.setItem('crm.registerDraft', JSON.stringify({ draft: complete(), step: 'payment' }));
    expect(loadDraft(storage)).toBeNull();
  });
});
