import { describe, expect, it } from 'vitest';
import { validateStepOne } from './convertValidation';

describe('validateStepOne', () => {
  it('accepts a name and a well-formed email', () => {
    expect(validateStepOne('Priya Shah', 'priya@example.com')).toEqual({});
  });

  it.each(['', '   '])('rejects a blank contact name %j', (name) => {
    expect(validateStepOne(name, 'priya@example.com')).toEqual({ contactName: 'Contact name is required.' });
  });

  it.each(['', 'x', 'priya', 'priya@', '@example.com', 'priya@example', 'pri ya@example.com'])(
    'rejects the email %j',
    (email) => {
      expect(validateStepOne('Priya Shah', email)).toEqual({ contactEmail: 'Enter a valid contact email.' });
    }
  );

  it('reports both fields when both are invalid', () => {
    expect(Object.keys(validateStepOne('', 'nope')).sort()).toEqual(['contactEmail', 'contactName']);
  });

  it('ignores surrounding whitespace in the email', () => {
    expect(validateStepOne('Priya Shah', '  priya@example.com  ')).toEqual({});
  });
});
