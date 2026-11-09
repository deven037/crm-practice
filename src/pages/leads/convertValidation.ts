export type StepOneErrors = Partial<Record<'contactName' | 'contactEmail', string>>;

export function validateStepOne(contactName: string, contactEmail: string): StepOneErrors {
  const errors: StepOneErrors = {};
  if (!contactName.trim()) errors.contactName = 'Contact name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) errors.contactEmail = 'Enter a valid contact email.';
  return errors;
}
