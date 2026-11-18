import { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, FileText, LucideIcon, Mail, MapPin, Phone, TrendingUp, Users } from 'lucide-react';
import { getAllSync } from '../../data/store';
import { Account, Activity, Contact, Deal, Lead, LinkedModule, User } from '../../types';
import { getStatusOptions } from '../../utils/rules';
import { classNames } from '../../utils';
import { activityType, hm, isSystemType, LinkTarget, minutesOf, spanLabel } from './activityLogic';

/** The bank's activity types and call outcomes (Setup, status codes). */
export const DEFAULT_ACTIVITY_TYPES = ['Call', 'Meeting', 'Visit', 'Email', 'Note'];
export const DEFAULT_CALL_OUTCOMES = ['Connected', 'Left a voicemail', 'No answer', 'Asked to call back', 'Wrong number'];
export const activityTypes = () => getStatusOptions('activities', 'type', DEFAULT_ACTIVITY_TYPES);
export const callOutcomes = () => getStatusOptions('activities', 'outcome', DEFAULT_CALL_OUTCOMES);
export const REMINDERS = ['No reminder', '5 minutes before', '15 minutes before', '1 hour before', '1 day before'];

const KNOWN: Record<string, { hue: string; icon: LucideIcon; verb: string }> = {
  call: { hue: '#2f6fe0', icon: Phone, verb: 'called' },
  meeting: { hue: '#6d4fd6', icon: Users, verb: 'met with' },
  visit: { hue: '#d9642b', icon: MapPin, verb: 'visited' },
  email: { hue: '#0f97a8', icon: Mail, verb: 'emailed' },
  note: { hue: '#8a93a6', icon: FileText, verb: 'added a note on' },
  'deal update': { hue: '#c98a12', icon: TrendingUp, verb: '' },
  'task done': { hue: '#17936a', icon: CheckCircle2, verb: '' },
};
const SPARE = ['#d1478d', '#0f6b52', '#9b1c3a', '#5b6b8c'];

/** Colour, icon and verb for any activity type, including ones a bank added itself. */
export function typeStyle(type: string): { hue: string; icon: LucideIcon; verb: string } {
  const known = KNOWN[type.trim().toLowerCase()];
  if (known) return known;
  let n = 0;
  for (const ch of type.toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return { hue: SPARE[n % SPARE.length], icon: Circle, verb: `logged ${/^[aeiou]/i.test(type) ? 'an' : 'a'} ${type.toLowerCase()} with` };
}
export const hue = (c: string) => ({ '--c': c }) as CSSProperties;

const KIND: Record<LinkedModule, { letter: string; hue: string; label: string }> = {
  deals: { letter: 'D', hue: '#c98a12', label: 'Deal' },
  contacts: { letter: 'C', hue: '#2f6fe0', label: 'Contact' },
  accounts: { letter: 'A', hue: '#6d4fd6', label: 'Account' },
  leads: { letter: 'L', hue: '#0f97a8', label: 'Lead' },
};
export const kindLabel = (m: LinkedModule) => KIND[m].label;

/** Every record a task, meeting or activity can be about, from what the app has already loaded. */
export function linkTargets(): LinkTarget[] {
  return [
    ...getAllSync<Contact>('contacts').map((r) => ({ module: 'contacts' as const, id: r.id, name: r.name })),
    ...getAllSync<Account>('accounts').map((r) => ({ module: 'accounts' as const, id: r.id, name: r.name })),
    ...getAllSync<Deal>('deals').map((r) => ({ module: 'deals' as const, id: r.id, name: r.name })),
    ...getAllSync<Lead>('leads').map((r) => ({ module: 'leads' as const, id: r.id, name: r.name })),
  ];
}
export const findTarget = (targets: LinkTarget[], module?: LinkedModule | null, id?: string | null) => (module && id ? targets.find((t) => t.module === module && t.id === id) : undefined);

export function KindMark({ module }: { module: LinkedModule }) {
  return <span className="act-kind" style={hue(KIND[module].hue)} aria-hidden="true">{KIND[module].letter}</span>;
}

/** A small link to the record something is about. */
export function RecordChip({ module, id, name }: { module?: LinkedModule | null; id?: string | null; name?: string }) {
  if (!module || !id || !name) return null;
  return (
    <Link className="act-rec" to={`/${module}/${id}`} onClick={(e) => e.stopPropagation()} title={`Open ${KIND[module].label.toLowerCase()}`}>
      <KindMark module={module} />
      <span>{name}</span>
    </Link>
  );
}

const PEOPLE_HUES = ['#1d3a6e', '#d9642b', '#0f97a8', '#6d4fd6', '#c98a12', '#17936a'];
export function personHue(id: string): string {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return PEOPLE_HUES[n % PEOPLE_HUES.length];
}
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export function Face({ id, name, small }: { id: string; name: string; small?: boolean }) {
  return (
    <i className={classNames('act-face', small && 'sm')} style={{ '--h': personHue(id) } as CSSProperties} title={name} aria-hidden="true">
      {initialsOf(name)}
    </i>
  );
}

export const userName = (users: User[], id?: string | null) => users.find((u) => u.id === id)?.name ?? '';

/** One line of the activity feed. Older activities without structured fields show their saved sentence. */
export function FeedEntry({ activity, last, delay = 0 }: { activity: Activity; last?: boolean; delay?: number }) {
  const type = activityType(activity);
  const style = typeStyle(type);
  const Icon = style.icon;
  const system = activity.system || isSystemType(type);
  const who = activity.userName ?? '';
  const name = activity.recordName ?? '';
  const sentence = who && name && !system ? (
    <><b>{who}</b> {style.verb} <RecordChip module={activity.recordModule} id={activity.recordId} name={name} /></>
  ) : (
    <>{activity.text}{system && name && activity.recordModule ? <> <RecordChip module={activity.recordModule} id={activity.recordId} name={name} /></> : null}</>
  );
  const meta = [activity.outcome, activity.durationMin ? spanLabel(activity.durationMin) : ''].filter(Boolean).join(' · ');
  return (
    <div className={classNames('act-fe', system && 'sys', last && 'last')} style={{ animationDelay: `${delay}ms` }} data-testid="activity-entry">
      <span className="act-fbub" style={hue(style.hue)} title={type}><Icon size={system ? 13 : 17} aria-hidden="true" /></span>
      <div className="act-fbody">
        <p>{sentence}</p>
        {!system && (meta || activity.type) && (
          <div className="act-fmeta"><span className="act-ty" style={hue(style.hue)}><i />{type}</span>{meta && <span>{meta}</span>}</div>
        )}
        {activity.notes && <div className="act-fdet">{activity.notes}</div>}
      </div>
      <time className="act-ftime" dateTime={activity.when}>{hm(minutesOf(activity.when))}</time>
    </div>
  );
}
