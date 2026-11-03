import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Clock, Target, User, Building2, DollarSign, ArrowRight, AlertTriangle, X, type LucideIcon } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

// Owner decisions (AIO-199, question #112): changing an answer is a one-line change here.
const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_MIN_CHARS = 2;
const RESULTS_PER_TYPE = 3;
const SLOW_LOADING_MS = 150;

type SearchType = 'leads' | 'contacts' | 'accounts' | 'deals';

interface SearchHit {
  id: string;
  name: string;
  subtitle: string;
  email?: string;
  phone?: string;
}

interface SearchGroup {
  items: SearchHit[];
  total: number;
}

type SearchResponse = { term: string } & Record<SearchType, SearchGroup>;

const TYPES: { key: SearchType; label: string; singular: string; icon: LucideIcon }[] = [
  { key: 'leads', label: 'Leads', singular: 'lead', icon: Target },
  { key: 'contacts', label: 'Contacts', singular: 'contact', icon: User },
  { key: 'accounts', label: 'Accounts', singular: 'account', icon: Building2 },
  { key: 'deals', label: 'Deals', singular: 'deal', icon: DollarSign },
];

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  group: 'Quick actions' | 'Recent';
  onSelect: () => void;
}

interface ResultOption {
  id: string;
  type: SearchType;
  kind: 'record' | 'all';
  label: string;
  detail?: string;
  meta?: string;
  to: string;
}

const QUICK_ACTIONS: { label: string; to: string }[] = [
  { label: '+ New Lead', to: '/leads/new' },
  { label: '+ New Contact', to: '/contacts/new' },
  { label: '+ New Account', to: '/accounts/new' },
  { label: '+ New Product', to: '/products/new' },
  { label: '+ New Campaign', to: '/campaigns/new' },
  { label: '+ New Quote', to: '/quotes/new' },
  { label: '+ New Deal', to: '/deals/new' },
];

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;

function Highlight({ text, term }: { text: string; term: string }) {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

function buildOptions(data: SearchResponse | null): ResultOption[] {
  if (!data) return [];
  return TYPES.flatMap(({ key, singular }) => {
    const group = data[key];
    const records = group.items.map<ResultOption>((hit) => ({
      id: `${key}-${hit.id}`,
      type: key,
      kind: 'record',
      label: hit.name,
      detail: [hit.subtitle, hit.email, hit.phone].filter(Boolean).join(', '),
      to: `/${key}/${hit.id}`,
    }));
    const seeAll: ResultOption[] =
      group.total > group.items.length
        ? [{ id: `${key}-all`, type: key, kind: 'all', label: `See all ${group.total} ${singular}s`, to: `/${key}?q=${encodeURIComponent(data.term)}` }]
        : [];
    return [...records, ...seeAll];
  });
}

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

/** Global ⌘K/Ctrl+K search — the header search button opens it. Grouped results come from GET /api/search; quick actions and recent records show before a term is typed. Controlled by Layout.tsx. */
export function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [slow, setSlow] = useState(false);
  const [resultTerm, setResultTerm] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const requestRef = useRef(0);
  const { items: recent } = useRecentlyViewed();

  const term = query.trim();
  const searching = term.length >= SEARCH_MIN_CHARS;

  const runSearch = useCallback(async (value: string) => {
    const requestId = ++requestRef.current;
    setStatus('loading');
    setSlow(false);
    const slowTimer = setTimeout(() => requestId === requestRef.current && setSlow(true), SLOW_LOADING_MS);
    try {
      const res = await apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(value)}&limit=${RESULTS_PER_TYPE}`);
      if (requestId !== requestRef.current) return;
      setData(res);
      setResultTerm(value);
      setStatus('ready');
    } catch {
      if (requestId !== requestRef.current) return;
      setStatus('error');
    } finally {
      clearTimeout(slowTimer);
    }
  }, []);

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
      setQuery('');
      setActiveIndex(0);
      setData(null);
      setStatus('idle');
      setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        requestRef.current++;
        if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!searching) {
      requestRef.current++;
      setData(null);
      setStatus('idle');
      setActiveIndex(0);
      return;
    }
    setActiveIndex(-1);
    const timer = setTimeout(() => runSearch(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, term, searching, runSearch]);

  useEffect(() => {
    if (status === 'error') retryRef.current?.focus();
  }, [status]);

  const items: CommandItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions: CommandItem[] = QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q)).map((a) => ({
      id: `action-${a.to}`,
      label: a.label,
      group: 'Quick actions',
      onSelect: () => navigate(a.to),
    }));
    const recentItems: CommandItem[] = recent.slice(0, 5).map((r) => ({
      id: `recent-${r.id}`,
      label: r.label,
      sublabel: r.module,
      group: 'Recent',
      onSelect: () => navigate(r.link),
    }));
    return [...actions, ...recentItems];
  }, [query, recent, navigate]);

  const options = useMemo(() => buildOptions(data), [data]);
  const optionCount = searching ? options.length : items.length;
  const optionId = (index: number) => `command-option-${index}`;
  const activeId = activeIndex >= 0 && activeIndex < optionCount ? optionId(activeIndex) : undefined;

  const openOption = (option: ResultOption) => {
    onClose();
    navigate(option.to);
  };

  const selectItem = (item: CommandItem) => {
    onClose();
    item.onSelect();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && optionCount > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % optionCount);
    } else if (e.key === 'ArrowUp' && optionCount > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? optionCount - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (searching) {
        // Results still loading or for an older term: wait, so a stale first option is never used.
        if (status !== 'ready' || resultTerm !== term) return;
        if (activeIndex >= 0 && options[activeIndex]) openOption(options[activeIndex]);
        else if (options[0]) openOption({ ...options[0], to: `/${options[0].type}?q=${encodeURIComponent(term)}` });
      } else if (items[activeIndex]) {
        selectItem(items[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const announcement = (() => {
    if (!searching) return query ? `Type ${SEARCH_MIN_CHARS} or more characters to search leads, contacts, accounts and deals.` : '';
    if (status === 'ready' && data) {
      const counts = TYPES.filter(({ key }) => data[key].total > 0);
      if (counts.length === 0) return `No matches for ${term}. Check the spelling, or search by company name, email address or phone number.`;
      const total = counts.reduce((sum, { key }) => sum + data[key].total, 0);
      return `${plural(total, 'result')} in ${plural(counts.length, 'type')}. ${counts.map(({ key, label }) => `${label} ${data[key].total}`).join(', ')}. Use the arrow keys to browse.`;
    }
    return '';
  })();

  if (!open) return null;

  const hasMatches = data !== null && TYPES.some(({ key }) => data[key].total > 0);
  let optionIndex = 0;

  return (
    <div className="command-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="command-panel" data-testid="command-bar">
        <div className="command-input-row">
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-label="Search leads, contacts, accounts and deals"
            aria-expanded="true"
            aria-controls="command-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-busy={status === 'loading'}
            aria-invalid={status === 'error'}
            data-testid="command-input"
            placeholder="Search or jump to an action…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button
              type="button"
              className="command-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          )}
          <kbd style={{ fontSize: 11, color: 'var(--text-muted)' }}>Esc</kbd>
        </div>
        <div className="command-list" id="command-listbox" role="listbox" aria-label="Search results">
          <div className="sr-only" role="status">{announcement}</div>

          {!searching && query && (
            <div className="search-hint" data-testid="search-short-hint">
              Type {SEARCH_MIN_CHARS} or more characters to search leads, contacts, accounts and deals.
            </div>
          )}

          {!searching &&
            (['Quick actions', 'Recent'] as const).map((group) => {
              const groupItems = items.filter((item) => item.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group}>
                  <div className="command-group-label">{group}</div>
                  {groupItems.map((item) => {
                    const idx = items.indexOf(item);
                    return (
                      <div
                        key={item.id}
                        id={optionId(idx)}
                        role="option"
                        aria-selected={idx === activeIndex}
                        className={`command-item${idx === activeIndex ? ' active' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => selectItem(item)}
                      >
                        {group === 'Quick actions' ? <Plus size={14} /> : <Clock size={14} />}
                        <span>{item.label}</span>
                        {item.sublabel && <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{item.sublabel}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}

          {searching && status === 'loading' && slow && (
            <div data-testid="search-loading" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <div key={n} className="command-skeleton-row">
                  <span className="command-skeleton tile" />
                  <span className="command-skeleton-lines">
                    <span className="command-skeleton" style={{ width: `${46 - n * 6}%` }} />
                    <span className="command-skeleton" style={{ width: `${70 - n * 6}%` }} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {searching && status === 'error' && (
            <div data-testid="search-error">
              <div className="command-banner" role="alert">
                <AlertTriangle size={18} />
                <div>
                  <strong>Search did not finish</strong>
                  Your term is kept, so you can try again.
                </div>
              </div>
              <div className="command-actions">
                <button ref={retryRef} className="btn btn-primary" onClick={() => runSearch(term)}>
                  Try again
                </button>
                <button className="btn" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}

          {searching && status === 'ready' && !hasMatches && (
            <div className="command-empty" data-testid="search-empty">
              <strong>No matches for "{term}"</strong>
              <p>Check the spelling, or search by company name, email address or phone number instead.</p>
              <button
                className="btn"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                Clear search
              </button>
            </div>
          )}

          {searching &&
            status === 'ready' &&
            data !== null &&
            TYPES.map(({ key, label, icon: Icon }) => {
              const group = data[key];
              if (group.total === 0) return null;
              const headingId = `command-group-${key}`;
              return (
                <div key={key} role="group" aria-labelledby={headingId}>
                  <div className="command-group-label" id={headingId}>
                    <strong>{label}</strong>
                    <span>{group.total === 1 ? '1 match' : `${group.total} matches`}</span>
                  </div>
                  {options
                    .filter((option) => option.type === key)
                    .map((option) => {
                      const idx = optionIndex++;
                      const active = idx === activeIndex;
                      return (
                        <div
                          key={option.id}
                          id={optionId(idx)}
                          role="option"
                          aria-selected={active}
                          className={`command-result${active ? ' active' : ''}${option.kind === 'all' ? ' see-all' : ''}`}
                          data-testid={option.kind === 'all' ? `search-see-all-${key}` : `search-result-${key}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => openOption(option)}
                        >
                          {option.kind === 'all' ? (
                            <>
                              <span>{option.label}</span>
                              <ArrowRight size={14} />
                            </>
                          ) : (
                            <>
                              <span className="command-glyph"><Icon size={16} /></span>
                              <span className="command-result-main">
                                <strong><Highlight text={option.label} term={term} /></strong>
                                {option.detail && <small><Highlight text={option.detail} term={term} /></small>}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
        </div>
        {searching && status === 'ready' && data !== null && hasMatches && (
          <div className="command-foot" data-testid="search-total">
            {plural(TYPES.reduce((sum, { key }) => sum + data[key].total, 0), 'result')} in{' '}
            {plural(TYPES.filter(({ key }) => data[key].total > 0).length, 'type')}
          </div>
        )}
      </div>
    </div>
  );
}
