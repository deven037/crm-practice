import { CSSProperties, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Contact } from '../../types';

/** Tags every bank starts with. Banks add their own by typing a new one. */
export const STARTER_TAGS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'];

const HUES = ['#2f6fe0', '#c98a12', '#17936a', '#6d4fd6', '#0f97a8', '#d1478d'];

/** A steady colour for one person, so the same contact looks the same on every screen. */
export function contactHue(key: string): string {
  let n = 0;
  for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[n % HUES.length];
}

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase() : '+';
}

export const hueStyle = (key: string) => ({ '--h': contactHue(key) }) as CSSProperties;

/** The person's photo, or their initials on their own colour. */
export function ContactFace({ contact, size }: { contact: Pick<Contact, 'id' | 'name' | 'avatar'>; size?: 'small' | 'large' }) {
  return (
    <span className={`contact-face${size ? ` ${size}` : ''}`} style={hueStyle(contact.id)} aria-hidden={contact.avatar ? undefined : true}>
      {contact.avatar ? <img src={contact.avatar} alt={contact.name} /> : contactInitials(contact.name)}
    </span>
  );
}

export interface ContactGroup {
  key: string;
  contacts: Contact[];
}

/** Contacts sorted by name and split into letter groups, or into account groups. */
export function groupContacts(contacts: Contact[], by: 'letter' | 'account', accountName: (id: string | null) => string): ContactGroup[] {
  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  const keyOf = (c: Contact) => {
    if (by === 'account') return c.accountId ? accountName(c.accountId) : 'No account';
    const first = c.name.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(first) ? first : '#';
  };
  const groups = new Map<string, Contact[]>();
  for (const c of sorted) groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({ key, contacts: list }));
}

/** Every tag in use, plus the starter tags, in alphabetical order. */
export function allContactTags(contacts: Pick<Contact, 'tags'>[], withStarters = true): string[] {
  return [...new Set([...(withStarters ? STARTER_TAGS : []), ...contacts.flatMap((c) => c.tags)])].sort((a, b) => a.localeCompare(b));
}

export function filterByTags(contacts: Contact[], tags: string[]): Contact[] {
  return tags.length ? contacts.filter((c) => c.tags.some((t) => tags.includes(t))) : contacts;
}

/** Adds a typed tag once, trimmed. Returns the same list when there is nothing new to add. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = raw.trim().replace(/,+$/, '').trim();
  return !tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase()) ? tags : [...tags, tag];
}

/** A button that opens a searchable list of tags. Tags can pile up, so they never sit in a fixed row. */
export function TagPicker({ label, tags, selected, onToggle, allowNew, align = 'left', testId }: {
  label: ReactNode; tags: string[]; selected: string[]; onToggle: (tag: string) => void; allowNew?: boolean; align?: 'left' | 'right'; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = find.trim().toLowerCase();
  const shown = tags.filter((t) => t.toLowerCase().includes(q));
  const fresh = allowNew && q && !tags.some((t) => t.toLowerCase() === q);
  return (
    <span className="tag-picker" ref={wrap}>
      <button type="button" className={`tag-picker-btn${selected.length && !allowNew ? ' set' : ''}`} aria-haspopup="listbox" aria-expanded={open} data-testid={testId}
        onClick={() => { setOpen((o) => !o); setFind(''); }}>
        {label}
      </button>
      {open && (
        <div className={`tag-picker-pop ${align}`}>
          <input className="tag-picker-find" autoFocus aria-label={allowNew ? 'Find or type a new tag' : 'Find a tag'} placeholder={allowNew ? 'Find or type a new tag' : 'Find a tag'}
            value={find} onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && fresh) { e.preventDefault(); onToggle(find.trim()); setFind(''); } }} />
          <div role="listbox" aria-multiselectable="true" aria-label="Tags">
            {shown.map((t) => (
              <button type="button" key={t} role="option" aria-selected={selected.includes(t)} className="tag-picker-option" onClick={() => onToggle(t)}>
                {t}
                {selected.includes(t) && <Check size={15} className="tag-picker-tick" aria-hidden="true" />}
              </button>
            ))}
            {fresh && (
              <button type="button" role="option" aria-selected={false} className="tag-picker-option" onClick={() => { onToggle(find.trim()); setFind(''); }}>
                <Plus size={14} aria-hidden="true" /> Add “{find.trim()}”
              </button>
            )}
            {shown.length === 0 && !fresh && <div className="tag-picker-none">No tag matches.</div>}
          </div>
        </div>
      )}
    </span>
  );
}

/** Tags as chips with a box to type a new one (Enter or comma adds, Backspace on an empty box removes the last). */
export function TagInput({ id, tags, suggestions, onChange, testId }: { id: string; tags: string[]; suggestions: string[]; onChange: (tags: string[]) => void; testId?: string }) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const box = e.currentTarget;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const next = addTag(tags, box.value);
      box.value = '';
      if (next !== tags) onChange(next);
    } else if (e.key === 'Backspace' && !box.value && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  const offered = suggestions.filter((t) => !tags.includes(t)).slice(0, 6);
  return (
    <div className="tag-input" data-testid={testId}>
      <div className="tag-input-box">
        {tags.map((t) => (
          <span key={t} className="contact-tag">
            {t}
            <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X size={11} aria-hidden="true" /></button>
          </span>
        ))}
        <input id={id} placeholder="Type a tag, press Enter" autoComplete="off" onKeyDown={onKeyDown}
          onBlur={(e) => { const next = addTag(tags, e.currentTarget.value); e.currentTarget.value = ''; if (next !== tags) onChange(next); }} />
      </div>
      {offered.length > 0 && (
        <div className="tag-input-offers">
          {offered.map((t) => (
            <button type="button" key={t} className="contact-tag add" onClick={() => onChange(addTag(tags, t))}><Plus size={11} aria-hidden="true" />{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}
