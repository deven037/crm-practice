import { z } from 'zod';
import { BANK_TYPES, isPublicMailDomain } from '../banks.js';
import { passwordProblem } from '../passwords.js';

const text = (label: string, max = 200) => z.string().trim().min(1, `${label} is required.`).max(max);

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Enter a domain like yourbank.com.')
  .refine((value) => !isPublicMailDomain(value), 'Use your bank\'s own email domain, not a public mail service.');

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const bankProfileSchema = z.object({
  displayName: text('Bank name', 80),
  legalName: text('Legal name'),
  bankType: z.enum(BANK_TYPES),
  registrationNumber: text('Licence or registration number', 60),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Choose a country.').transform((v) => v.toUpperCase()),
  address: text('Head office address', 400),
  website: z.string().trim().url('Enter a full web address, starting with https://').max(200).optional().or(z.literal('')),
  contactName: text('Contact person', 120),
  contactPhone: z.string().trim().regex(/^[+0-9 ()-]{6,24}$/, 'Enter a phone number.'),
  contactEmail: z.string().trim().email('Enter a valid email address.'),
  emailDomains: z.array(domain).min(1, 'Add at least one email domain.').max(5),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Choose a currency.').transform((v) => v.toUpperCase()),
  locale: z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Choose a language and region.'),
  timezone: z.string().trim().refine(validTimezone, 'Choose a timezone.'),
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a colour.'),
  branches: z.number().int().min(1).max(100000),
  expectedUsers: z.number().int().min(1).max(1000000),
  sampleData: z.boolean().default(false),
});

const imageDataUrl = z.string().max(6 * 1024 * 1024).startsWith('data:image/');

export const bankRegistrationSchema = bankProfileSchema
  .extend({
    admin: z.object({
      name: text('Your name', 120),
      email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
      password: z.string().superRefine((value, ctx) => {
        const problem = passwordProblem(value);
        if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
      }),
    }),
    logo: imageDataUrl.optional(),
    loginImage: imageDataUrl.optional(),
  })
  .superRefine((value, ctx) => {
    const adminDomain = value.admin.email.slice(value.admin.email.lastIndexOf('@') + 1);
    if (!value.emailDomains.includes(adminDomain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['admin', 'email'],
        message: 'The admin\'s email must be on one of the bank\'s email domains.',
      });
    }
  });

export const assetUploadSchema = z.object({ image: imageDataUrl });
export const decisionSchema = z.object({ reason: z.string().trim().max(500).optional() });
export const platformLoginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });
