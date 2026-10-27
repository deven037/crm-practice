export type StepOneErrors = Partial<Record<'contactName' | 'contactEmail', string>>;

export function validateStepOne(contactName: string, contactEmail: string): StepOneErrors {
  const errors: StepOneErrors = {};
  if (!contactName.trim()) errors.contactName = 'Enter a contact name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) errors.contactEmail = 'Enter a valid email address.';
  return errors;
}
