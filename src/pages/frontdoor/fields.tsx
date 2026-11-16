import { InputHTMLAttributes, ReactNode, useId, useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  testId?: string;
  /** data-testid for the error line, where tests look for it. */
  errorTestId?: string;
  optional?: boolean;
}

/** A labelled input with its hint and error, wired up for screen readers. */
export function Field({ label, value, onChange, error, hint, testId, errorTestId, optional, ...input }: FieldProps) {
  const id = useId();
  return (
    <label className={`fd-field${error ? ' has-error' : ''}`} htmlFor={id}>
      <span className="fd-label">
        {label}
        {optional && <em>Optional</em>}
      </span>
      <input
        id={id}
        data-testid={testId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      {error ? (
        <FieldError id={`${id}-error`} testId={errorTestId}>{error}</FieldError>
      ) : (
        hint && <span id={`${id}-hint`} className="fd-hint">{hint}</span>
      )}
    </label>
  );
}

export function FieldError({ id, testId, children }: { id?: string; testId?: string; children: ReactNode }) {
  return (
    <motion.span id={id} className="fd-err" role="alert" data-testid={testId} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
      {children}
    </motion.span>
  );
}

/** A password input with a show/hide button. With `rules`, it ticks off the password rule as it is met. */
export function PasswordField({ rules, ...props }: FieldProps & { rules?: boolean }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const { label, value, onChange, error, testId, errorTestId, hint, optional: _optional, ...input } = props;
  const checks = [
    { ok: value.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(value), text: 'A letter' },
    { ok: /[0-9]/.test(value), text: 'A number' },
  ];
  return (
    <div className={`fd-field${error ? ' has-error' : ''}`}>
      <label className="fd-label" htmlFor={id}>{label}</label>
      <div className="fd-ctl">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          data-testid={testId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : rules ? `${id}-rules` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...input}
        />
        <button type="button" className="fd-eye" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown((s) => !s)}>
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <FieldError id={`${id}-error`} testId={errorTestId}>{error}</FieldError>}
      {!error && hint && <span className="fd-hint">{hint}</span>}
      {rules && (
        <ul id={`${id}-rules`} className="fd-rules">
          {checks.map((check) => (
            <li key={check.text} className={check.ok ? 'is-met' : ''}>
              <i aria-hidden="true">{check.ok && <Check size={11} strokeWidth={3.5} />}</i>
              {check.text}
              <span className="sr-only">{check.ok ? ' (met)' : ' (not met yet)'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The main button of a front-door form. While busy it shows a spinner and cannot be pressed twice. */
export function SubmitButton({ busy, busyLabel, children, testId, disabled }: { busy?: boolean; busyLabel?: string; children: ReactNode; testId?: string; disabled?: boolean }) {
  return (
    <button type="submit" className="fd-btn" data-testid={testId} disabled={busy || disabled} aria-busy={busy}>
      {busy && <span className="fd-spin" aria-hidden="true" />}
      <span>{busy ? busyLabel ?? children : children}</span>
    </button>
  );
}

/** A message above a form: something went wrong, or something the person should know. */
export function Notice({ tone = 'error', children, testId, title }: { tone?: 'error' | 'info' | 'ok' | 'warn'; children: ReactNode; testId?: string; title?: string }) {
  const Icon = tone === 'error' || tone === 'warn' ? AlertCircle : tone === 'ok' ? Check : Info;
  return (
    <motion.div
      className={`fd-notice fd-notice-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
    >
      <Icon size={17} aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </div>
    </motion.div>
  );
}
