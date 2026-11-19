import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, CornerDownLeft, Search, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { NAV_GROUPS } from './shell/nav';
import {
  fetchRecentSearches, fetchSearch, groupHits, hitPath, isActionQuery, matchActions, matchLine, rememberSearch, resultsPagePath,
  SEARCH_MIN_CHARS, TYPE_META, type SearchHit, type SearchResult, type SearchType,
} from '../pages/search/searchLogic';
import { LockNote, Marked, SearchPreview, TypeIcon } from '../pages/search/searchBits';

// Owner decisions (AIO-199, question #112): changing an answer is a one-line change here.
const SEARCH_DEBOUNCE_MS = 250;
const RESULTS_PER_TYPE = 3;
const SLOW_LOADING_MS = 150;
/** How many ranked matches the quick search asks for; it shows the best few of each type. */
const QUICK_PAGE_SIZE = 60;
const TRY_CHIPS = ['type:ticket owner:me', 'status:open', '>'];

/** Every page in the side menu, so the bar can jump to one by name. */
const PAGES = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
const PAGES_IDLE = 5;
const PAGES_MATCHED = 6;

/** The pages whose name contains what was typed; the first few when nothing is typed yet. */
export function matchPages(query: string) {
  const q = query.trim().toLowerCase();
  return PAGES.filter((page) => !q || page.label.toLowerCase().includes(q)).slice(0, q ? PAGES_MATCHED : PAGES_IDLE);
}

/** Esc is handled on the document while the panel is open, so it also works when focus is on "Try again", Close, a result, or has dropped to the body. */
export const isCloseKey = (key: string) => key === 'Escape';

/** Closing returns focus to the opener mid-keydown; without this the browser's default Enter action would click it and reopen the panel. */
export const consumeEnter = (e: { key: string; preventDefault: () => void }) => {
  if (e.key !== 'Enter') return false;
  e.preventDefault();
  return true;
};

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;

/** One row a person can move to with the arrow keys. */
type Option =
  | { kind: 'record'; id: string; hit: SearchHit; jump: boolean }
  | { kind: 'all'; id: string; type: SearchType; total: number }
  | { kind: 'link'; id: string; label: string; sub?: string; icon: LucideIcon; to: string; testId: string; action?: boolean };

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Quick search (Ctrl K), Search 3.0. Grouped matches on the left and a live preview of the picked one on the right.
 * Empty: recent searches, recently opened records and pages. A reference (TK-0010, Q-2026-0142) offers to go straight
 * to the record; ">" lists things to do. Controlled by Layout.tsx.
 */
export function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState<SearchResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [slow, setSlow] = useState(false);
  const [resultTerm, setResultTerm] = useState('');
  const [recentTerms, setRecentTerms] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const requestRef = useRef(0);
  const { items: recent } = useRecentlyViewed();

  const term = query.trim();
  const actionMode = isActionQuery(query);
  const searching = !actionMode && term.length >= SEARCH_MIN_CHARS;

  const runSearch = useCallback(async (value: string) => {
    const requestId = ++requestRef.current;
    setStatus('loading');
    setSlow(false);
    const slowTimer = setTimeout(() => requestId === requestRef.current && setSlow(true), SLOW_LOADING_MS);
    try {
      const res = await fetchSearch({ q: value, pageSize: QUICK_PAGE_SIZE });
      if (requestId !== requestRef.current) return;
      setData(res);
      setResultTerm(value);
      setStatus('ready');
      setActiveIndex(0);
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
      fetchRecentSearches().then(setRecentTerms, () => setRecentTerms([]));
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

  useEffect(() => {
    if (!open) return;
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (isCloseKey(e.key)) onClose();
    };
    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [open, onClose]);

  const ready = searching && status === 'ready' && data !== null && resultTerm === term;
  const groups = useMemo(() => {
    if (!ready || !data) return [];
    const rest = data.items.filter((h) => !(data.jump && h.type === data.jump.type && h.id === data.jump.id));
    // The group holding the best match comes first; the others follow by their own best match.
    return groupHits(rest)
      .map((g) => ({ ...g, total: (data.counts[g.type] ?? 0) - (data.jump?.type === g.type ? 1 : 0) }))
      .sort((a, b) => b.hits[0].score - a.hits[0].score);
  }, [ready, data]);

  const pageLinks: Option[] = useMemo(
    () =>
      (actionMode ? [] : matchPages(query)).map((page) => ({
        kind: 'link', id: `page-${page.to}`, label: page.label, sub: page.group, icon: page.icon, to: page.to, testId: 'command-page',
      })),
    [query, actionMode]
  );

  /** Every row in screen order; arrows move through these. */
  const options: Option[] = useMemo(() => {
    if (actionMode) {
      return matchActions(query, role).map((a) => ({
        kind: 'link', id: `action-${a.id}`, label: a.label, sub: `Opens ${a.where}`, icon: a.icon, to: a.to, testId: 'command-action', action: true,
      }));
    }
    if (!term) {
      const opened: Option[] = recent.slice(0, 4).map((r) => ({
        kind: 'link', id: `recent-${r.id}`, label: r.label, sub: r.module.charAt(0).toUpperCase() + r.module.slice(1), icon: Clock, to: r.link, testId: 'command-recent',
      }));
      return [...opened, ...pageLinks];
    }
    if (!ready || !data) return pageLinks;
    const out: Option[] = [];
    if (data.jump) out.push({ kind: 'record', id: `jump-${data.jump.id}`, hit: data.jump, jump: true });
    for (const g of groups) {
      for (const hit of g.hits.slice(0, RESULTS_PER_TYPE)) out.push({ kind: 'record', id: `${g.type}-${hit.id}`, hit, jump: false });
      if (g.total > RESULTS_PER_TYPE) out.push({ kind: 'all', id: `${g.type}-all`, type: g.type, total: g.total });
    }
    return [...out, ...pageLinks];
  }, [actionMode, term, query, role, recent, pageLinks, ready, data, groups]);

  const optionId = (index: number) => `command-option-${index}`;
  const activeId = activeIndex >= 0 && activeIndex < options.length ? optionId(activeIndex) : undefined;
  const active = activeIndex >= 0 ? options[activeIndex] : undefined;
  const previewHit = active?.kind === 'record' ? active.hit : null;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const remember = (value: string) => {
    if (value.trim().length >= SEARCH_MIN_CHARS && !isActionQuery(value)) void rememberSearch(value);
  };

  const go = (to: string, newTab = false) => {
    if (newTab) {
      window.open(to, '_blank', 'noopener');
      return;
    }
    onClose();
    navigate(to);
  };

  const choose = (option: Option, newTab = false) => {
    if (option.kind === 'record') {
      remember(term);
      go(hitPath(option.hit, role), newTab);
    } else if (option.kind === 'all') {
      remember(term);
      go(resultsPagePath(term, option.type), newTab);
    } else {
      go(option.to, newTab);
    }
  };

  const openResultsPage = () => {
    remember(term);
    go(resultsPagePath(term));
  };

  const setTerm = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = options.length;
    if (e.key === 'ArrowDown' && count > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
    } else if (e.key === 'ArrowUp' && count > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (consumeEnter(e)) {
      const newTab = e.ctrlKey || e.metaKey;
      if (active) {
        choose(active, newTab);
        return;
      }
      // Results still loading or for an older term: wait, so a stale option is never used.
      if (searching && ready) openResultsPage();
    }
  };

  const announcement = (() => {
    if (actionMode) return `${plural(options.length, 'action')}.`;
    if (term && !searching) return `Type ${SEARCH_MIN_CHARS} or more characters to search every record.`;
    if (ready && data) {
      if (data.total === 0) return `No matches for ${term}.`;
      const kinds = groups.map((g) => `${TYPE_META[g.type].label} ${g.total}`);
      return [`${plural(data.total, 'result')}${data.jump ? `, including ${data.jump.ref}` : ''}.`, kinds.length ? `${kinds.join(', ')}.` : '', 'Use the arrow keys to browse.']
        .filter(Boolean)
        .join(' ');
    }
    return '';
  })();

  if (!open) return null;

  const hasMatches = ready && data !== null && data.total > 0;
  let index = 0;
  const rowProps = (option: Option) => {
    const idx = index++;
    return {
      id: optionId(idx),
      role: 'option' as const,
      'aria-selected': idx === activeIndex,
      className: `sx-it${idx === activeIndex ? ' on' : ''}${option.kind === 'record' && option.jump ? ' jump' : ''}${option.kind === 'all' ? ' all' : ''}`,
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onMouseEnter: () => setActiveIndex(idx),
      onClick: (e: React.MouseEvent) => choose(option, e.ctrlKey || e.metaKey),
    };
  };

  const linkRow = (option: Extract<Option, { kind: 'link' }>) => {
    const Icon = option.icon;
    return (
      <div key={option.id} {...rowProps(option)} data-testid={option.testId}>
        <span className="sx-tyi plain" aria-hidden="true"><Icon size={15} /></span>
        <span className="sx-tx"><b>{option.label}</b>{option.sub && <small>{option.sub}</small>}</span>
        {option.action && <span className="sx-kbd" aria-hidden="true"><CornerDownLeft size={11} /></span>}
      </div>
    );
  };

  const recordRow = (option: Extract<Option, { kind: 'record' }>) => {
    const { hit } = option;
    const line = matchLine(hit);
    if (option.jump) {
      return (
        <div key={option.id} {...rowProps(option)} data-testid="search-jump">
          <TypeIcon type={hit.type} />
          <span className="sx-tx"><b>{hit.ref} · {hit.title}</b><small>{hit.sub || TYPE_META[hit.type].one}</small></span>
          <span className="sx-kbd" aria-hidden="true"><CornerDownLeft size={11} /></span>
        </div>
      );
    }
    return (
      <div key={option.id} {...rowProps(option)} data-testid={`search-result-${TYPE_META[hit.type].key}`}>
        <TypeIcon type={hit.type} />
        <span className="sx-tx">
          <b><Marked text={hit.title} words={data?.text ?? ''} /></b>
          <small>{line ? <>{line.label}: <Marked text={line.value} words={data?.text ?? ''} /></> : hit.sub || (hit.ref ? hit.ref : TYPE_META[hit.type].one)}</small>
        </span>
        {hit.status && <span className="sx-why">{hit.status}</span>}
      </div>
    );
  };

  const recordOptions = options.filter((o) => o.kind !== 'link');
  const pageOptions = options.filter((o): o is Extract<Option, { kind: 'link' }> => o.kind === 'link' && o.testId === 'command-page');
  const recentOptions = options.filter((o): o is Extract<Option, { kind: 'link' }> => o.kind === 'link' && o.testId === 'command-recent');

  return (
    <div className="command-overlay sx-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sx-qs" role="dialog" aria-label="Search" data-testid="command-bar">
        <div className="sx-in">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-label="Search every record, or type > for actions"
            aria-expanded="true"
            aria-controls="command-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-busy={status === 'loading'}
            aria-invalid={status === 'error'}
            data-testid="command-input"
            placeholder="Search anything, or type > for actions"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          {actionMode && <span className="sx-scope">Actions</span>}
          {query && (
            <button type="button" className="sx-clear" aria-label="Clear search" onClick={() => setTerm('')}>
              <X size={14} />
            </button>
          )}
          <kbd className="sx-kbd">Esc</kbd>
        </div>

        <div className="sx-body">
          <div className="sx-list" id="command-listbox" role="listbox" aria-label="Search results" ref={listRef}>
            <div className="sr-only" role="status">{announcement}</div>

            {!term && (
              <>
                {recentTerms.length > 0 && (
                  <>
                    <div className="sx-grp"><span>Recent searches</span></div>
                    <div className="sx-chips">
                      {recentTerms.map((t) => (
                        <button key={t} type="button" className="sx-chip" data-testid="search-recent-term" onMouseDown={(e) => e.preventDefault()} onClick={() => setTerm(t)}>
                          <Clock size={13} aria-hidden="true" />{t}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {recentOptions.length > 0 && <div className="sx-grp"><span>Recently opened</span></div>}
                {recentOptions.map(linkRow)}
              </>
            )}

            {actionMode && (
              <>
                <div className="sx-grp"><span>Things to do</span></div>
                {options.length === 0 && <div className="sx-empty"><b>No action matches</b>Try “new”, “log” or “book”.</div>}
                {options.map((o) => linkRow(o as Extract<Option, { kind: 'link' }>))}
              </>
            )}

            {term && !actionMode && !searching && (
              <div className="sx-hint" data-testid="search-short-hint">
                Type {SEARCH_MIN_CHARS} or more characters to search every record.
              </div>
            )}

            {searching && status === 'loading' && slow && (
              <div data-testid="search-loading" aria-hidden="true">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="sx-skel-row">
                    <span className="sx-skel tile" />
                    <span className="sx-skel-lines">
                      <span className="sx-skel" style={{ width: `${46 - n * 6}%` }} />
                      <span className="sx-skel" style={{ width: `${70 - n * 6}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {searching && status === 'error' && (
              <div data-testid="search-error" className="sx-error">
                <div className="sx-banner" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <div><strong>Search did not finish</strong>Your term is kept, so you can try again.</div>
                </div>
                <div className="sx-error-acts">
                  <button ref={retryRef} type="button" className="btn btn-primary" onClick={() => runSearch(term)}>Try again</button>
                  <button type="button" className="btn" onClick={onClose}>Close</button>
                </div>
              </div>
            )}

            {ready && data && !hasMatches && (
              <div className="sx-empty" data-testid="search-empty">
                <b>Nothing matches “{term}”</b>
                Check the spelling, or search by phone, email, a custom field or a reference like TK-0010.
                {role === 'viewer' && <><br /><LockNote>Viewers can’t search by email or phone.</LockNote></>}
                <div><button type="button" className="btn" onClick={() => setTerm('')}>Clear search</button></div>
              </div>
            )}

            {ready && data && hasMatches && (() => {
              index = 0;
              const rows: React.ReactNode[] = [];
              let pos = 0;
              if (data.jump) {
                rows.push(<div key="jump-label" className="sx-grp"><span>Go straight to</span></div>);
                rows.push(recordRow(recordOptions[pos++] as Extract<Option, { kind: 'record' }>));
              }
              for (const g of groups) {
                const headingId = `command-group-${g.type}`;
                const shown = Math.min(g.hits.length, RESULTS_PER_TYPE) + (g.total > RESULTS_PER_TYPE ? 1 : 0);
                const slice = recordOptions.slice(pos, pos + shown);
                pos += shown;
                rows.push(
                  <div key={g.type} role="group" aria-labelledby={headingId}>
                    <div className="sx-grp" id={headingId}>
                      <span><strong>{TYPE_META[g.type].label}</strong> · {g.total}</span>
                    </div>
                    {slice.map((o) =>
                      o.kind === 'all' ? (
                        <div key={o.id} {...rowProps(o)} data-testid={`search-see-all-${TYPE_META[o.type].key}`}>
                          <span className="sx-tx"><b>See all {o.total} {TYPE_META[o.type].label.toLowerCase()}</b></span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </div>
                      ) : (
                        recordRow(o as Extract<Option, { kind: 'record' }>)
                      )
                    )}
                  </div>
                );
              }
              return rows;
            })()}

            {pageOptions.length > 0 && (
              <>
                <div className="sx-grp"><span>Go to</span></div>
                {pageOptions.map(linkRow)}
              </>
            )}

            {!term && (
              <>
                <div className="sx-grp"><span>Try</span></div>
                <div className="sx-chips">
                  {TRY_CHIPS.map((t) => (
                    <button key={t} type="button" className="sx-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => setTerm(t)}>
                      {t === '>' ? '> actions' : t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <SearchPreview
            hit={previewHit}
            words={data?.text ?? ''}
            role={role}
            idle={actionMode ? 'Actions open the page ready to fill in.' : 'Pick a result to see it here without leaving where you are.'}
            onOpen={(hit) => { remember(term); go(hitPath(hit, role)); }}
            onAction={(to) => { remember(term); go(to); }}
          />
        </div>

        <div className="sx-foot">
          <span className="sx-keys" aria-hidden="true"><kbd className="sx-kbd">↑</kbd><kbd className="sx-kbd">↓</kbd> move</span>
          <span className="sx-keys" aria-hidden="true"><kbd className="sx-kbd">↵</kbd> open</span>
          <span className="sx-keys k2" aria-hidden="true"><kbd className="sx-kbd">Ctrl</kbd><kbd className="sx-kbd">↵</kbd> new tab</span>
          <span className="sx-sp" />
          {hasMatches && data && <span data-testid="search-total">{plural(data.total, 'result')}</span>}
          {searching ? (
            <button type="button" className="sx-link" data-testid="search-see-all-results" onMouseDown={(e) => e.preventDefault()} onClick={openResultsPage}>
              See all results <ArrowRight size={13} aria-hidden="true" />
            </button>
          ) : (
            <span>Searches every record your role can see</span>
          )}
        </div>
      </div>
    </div>
  );
}
