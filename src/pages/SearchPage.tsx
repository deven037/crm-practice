import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { moneyShort } from './quotes/quoteLogic';
import {
  agoText, fetchSearch, groupHits, hitActions, hitPath, isSearchType, matchLine, rememberSearch, SEARCH_MIN_CHARS, SEARCH_TYPES,
  splitTokens, TYPE_META, type SearchHit, type SearchResult,
} from './search/searchLogic';
import { LockNote, Marked, TypeIcon } from './search/searchBits';

const DEBOUNCE_MS = 250;
const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * The search results page (/search?q=), Search 3.0. Best match first, a bar of matches by type that filters when
 * clicked, type:/owner:/status: tokens in the box, Owner and Status facets, and the field each match was found in.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const q = params.get('q') ?? '';
  const types = list(params.get('types')).filter(isSearchType);
  const owners = list(params.get('owners'));
  const statuses = list(params.get('statuses'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { tokens: allTokens, plain } = splitTokens(q);

  const [draft, setDraft] = useState(plain);
  const [data, setData] = useState<SearchResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  /** The last query this page wrote from typing, so the box is not rewritten under the person's fingers. */
  const typedRef = useRef<string | null>(null);
  const key = params.toString();

  // The box shows the words; the tokens sit beside it. Keep it in step when the address changes (back, a token removed).
  useEffect(() => {
    const next = params.get('q') ?? '';
    if (next === typedRef.current) return;
    typedRef.current = null;
    setDraft(splitTokens(next).plain);
  }, [params]);

  // Filters typed in the box stay there as text; filters that came with the address show as chips.
  const typedTokens = splitTokens(draft).tokens;
  const tokens = allTokens.filter((t) => !typedTokens.includes(t));
  const boxText = tokens.length === allTokens.length ? plain : draft;

  const update = (next: { q?: string; types?: string[]; owners?: string[]; statuses?: string[]; page?: number }, push = false) => {
    const p = new URLSearchParams();
    const nq = next.q ?? q;
    if (nq) p.set('q', nq);
    const t = next.types ?? types;
    const o = next.owners ?? owners;
    const s = next.statuses ?? statuses;
    if (t.length) p.set('types', t.join(','));
    if (o.length) p.set('owners', o.join(','));
    if (s.length) p.set('statuses', s.join(','));
    const pg = next.page ?? 1;
    if (pg > 1) p.set('page', String(pg));
    setParams(p, { replace: !push });
  };

  // Typing: wait a moment, then put the words back together with the tokens.
  useEffect(() => {
    if (draft === boxText) return;
    const timer = setTimeout(() => {
      const nq = [...tokens, draft].join(' ').replace(/\s+/g, ' ').trim();
      typedRef.current = nq;
      update({ q: nq, owners: [], statuses: [] });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < SEARCH_MIN_CHARS) {
      requestRef.current++;
      setData(null);
      setStatus('idle');
      return;
    }
    const id = ++requestRef.current;
    setStatus('loading');
    fetchSearch({ q: term, types, owners, statuses, page }).then(
      (res) => {
        if (id !== requestRef.current) return;
        setData(res);
        setStatus('ready');
      },
      () => id === requestRef.current && setStatus('error')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A search someone stayed on goes into their recent searches.
  useEffect(() => {
    const term = q.trim();
    if (term.length < SEARCH_MIN_CHARS) return;
    const timer = setTimeout(() => void rememberSearch(term), 2000);
    return () => clearTimeout(timer);
  }, [q]);

  // "/" anywhere on the page goes to the box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (values: string[], value: string) => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  const words = data?.text ?? '';
  const filtered = types.length + owners.length + statuses.length > 0;
  const best = data && data.page === 1 && data.items[0] && data.items[0].score >= 50 ? data.items[0] : null;
  const rest = useMemo(() => (data ? (best ? data.items.slice(1) : data.items) : []), [data, best]);
  const typeTotal = data ? SEARCH_TYPES.reduce((sum, t) => sum + (data.counts[t] ?? 0), 0) : 0;
  const open = (hit: SearchHit) => navigate(hitPath(hit, role));

  const removeToken = (token: string) => update({ q: [...tokens.filter((t) => t !== token), draft].join(' ').replace(/\s+/g, ' ').trim(), owners: [], statuses: [] }, true);

  return (
    <div className="sx-page" data-testid="search-page">
      <div className="page-header">
        <div>
          <h1>Search</h1>
          <p className="sx-sub">
            {data && q
              ? `${plural(data.total, 'result')}${plain ? ` for “${plain}”` : ''}${allTokens.length ? ' with filters' : ''}`
              : 'Find any record by name, reference, phone, email or a field your bank added.'}
          </p>
        </div>
      </div>

      <label className="sx-bar">
        <Search size={19} aria-hidden="true" />
        {tokens.map((t) => (
          <span key={t} className="sx-tok" data-testid="search-token">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={(e) => { e.preventDefault(); removeToken(t); }}><X size={12} /></button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          placeholder={tokens.length ? 'Add words' : 'Search records'}
          aria-label="Search records"
          autoComplete="off"
          spellCheck={false}
          data-testid="search-page-input"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !draft && tokens.length) {
              e.preventDefault();
              removeToken(tokens[tokens.length - 1]);
            }
          }}
          autoFocus={!q}
        />
        <kbd className="sx-kbd" aria-hidden="true">/</kbd>
      </label>

      {data && data.total > 0 && (
        <>
          <div className={`sx-spec${types.length ? ' picked' : ''}`} role="group" aria-label="Results by type" data-testid="search-type-bar">
            {SEARCH_TYPES.filter((t) => data.counts[t]).map((t, i) => {
              const Icon = TYPE_META[t].icon;
              return (
                <button
                  key={t}
                  type="button"
                  style={{ ['--n' as string]: data.counts[t], ['--c' as string]: TYPE_META[t].hue, animationDelay: `${i * 50}ms` }}
                  aria-pressed={types.includes(t)}
                  aria-label={`${TYPE_META[t].label}: ${data.counts[t]}`}
                  title={`${TYPE_META[t].label}: ${data.counts[t]}`}
                  data-testid={`search-type-${t}`}
                  onClick={() => update({ types: toggle(types, t) }, true)}
                >
                  <Icon size={14} aria-hidden="true" /><span>{data.counts[t]}</span>
                </button>
              );
            })}
          </div>
          <div className="sx-spec-k">
            {SEARCH_TYPES.filter((t) => data.counts[t]).map((t) => (
              <span key={t} style={{ ['--c' as string]: TYPE_META[t].hue }}><i />{TYPE_META[t].label} {data.counts[t]}</span>
            ))}
            {typeTotal > 0 && filtered && (
              <button type="button" className="sx-link" data-testid="search-clear-filters" onClick={() => update({ types: [], owners: [], statuses: [] }, true)}>
                Clear filters
              </button>
            )}
          </div>
        </>
      )}

      <div className="sx-cols">
        <div>
          {q.trim().length < SEARCH_MIN_CHARS ? (
            <div className="card sx-none" data-testid="search-page-start">
              <b>Start typing</b>
              Results show as you type. Use type:, owner: and status: to narrow, for example <b>type:ticket owner:me</b>.
            </div>
          ) : status === 'error' ? (
            <div className="card sx-none" role="alert" data-testid="search-page-error">
              <b>Search did not finish</b>
              <button type="button" className="btn" onClick={() => update({}, false)}>Try again</button>
            </div>
          ) : !data ? (
            <div className="card sx-none" aria-busy="true">Searching…</div>
          ) : data.shown === 0 ? (
            <div className="card sx-none" data-testid="search-page-empty">
              <b>Nothing matches</b>
              {data.total > 0
                ? 'Clear a filter to see the other results.'
                : 'Check the spelling, or try a phone number, a custom field or a reference like TK-0010.'}
              {data.total === 0 && role === 'viewer' && <div><LockNote>Viewers can’t search by email or phone.</LockNote></div>}
            </div>
          ) : (
            <div className={status === 'loading' ? 'sx-dim' : ''}>
              {best && (
                <section className="card sx-best" data-testid="search-best">
                  <TypeIcon type={best.type} size={24} big />
                  <div className="sx-best-main">
                    <span className="sx-lab">{TYPE_META[best.type].one}{best.ref ? ` · ${best.ref}` : ''}</span>
                    <h3><Link to={hitPath(best, role)}><Marked text={best.title} words={words} /></Link></h3>
                    <div className="sx-meta">
                      {best.sub && <span>{best.sub}</span>}
                      {best.status && <span>{best.status}</span>}
                      {best.ownerName && <span>Owner {best.ownerName}</span>}
                      {best.amount ? <span>{moneyShort(best.amount)}</span> : null}
                    </div>
                    {matchLine(best) && <span className="sx-hit">Matched in <em>{best.matchedIn}</em>: <Marked text={best.matchedValue} words={words} /></span>}
                  </div>
                  <div className="sx-acts">
                    <button type="button" className="btn btn-primary" onClick={() => open(best)}>Open</button>
                    {hitActions(best, role).map((a) => (
                      <button key={a.label} type="button" className="btn" onClick={() => navigate(a.to)}>{a.label}</button>
                    ))}
                  </div>
                </section>
              )}
              <div className="sx-res">
                {groupHits(rest).map((g) => (
                  <section key={g.type} aria-label={TYPE_META[g.type].label}>
                    <div className="sx-rs-grp"><h3>{TYPE_META[g.type].label}</h3><span className="sx-muted">{g.hits.length}</span></div>
                    {g.hits.map((h, i) => {
                      const line = matchLine(h);
                      return (
                        <Link key={h.id} to={hitPath(h, role)} className="sx-rs" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }} data-testid="search-row">
                          <TypeIcon type={h.type} />
                          <span className="sx-rs-main">
                            <b><Marked text={h.title} words={words} /></b>
                            <span className="sx-rs-sub">{[h.ref, h.sub].filter(Boolean).join(' · ') || TYPE_META[h.type].one}</span>
                            {line && <span className="sx-hit">Matched in <em>{line.label}</em>: <Marked text={line.value} words={words} /></span>}
                          </span>
                          <span className="sx-side">
                            {h.status && <>{h.status}<br /></>}
                            {agoText(h.at)}
                          </span>
                        </Link>
                      );
                    })}
                  </section>
                ))}
              </div>
              {data.totalPages > 1 && (
                <nav className="sx-pager" aria-label="Pages" data-testid="search-pager">
                  <button type="button" className="btn" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 }, true)}>
                    <ChevronLeft size={15} aria-hidden="true" /> Previous
                  </button>
                  <span>Page {data.page} of {data.totalPages} · {plural(data.shown, 'result')}</span>
                  <button type="button" className="btn" disabled={data.page >= data.totalPages} onClick={() => update({ page: data.page + 1 }, true)}>
                    Next <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </div>
          )}
        </div>

        <aside className="sx-facets">
          {data && data.owners.length > 0 && (
            <section className="card sx-facet" data-testid="search-facet-owner">
              <h4>Owner</h4>
              {data.owners.map((o) => (
                <button key={o.id} type="button" className="sx-fopt" role="menuitemcheckbox" aria-checked={owners.includes(o.id)} onClick={() => update({ owners: toggle(owners, o.id) }, true)}>
                  <span className="sx-bx"><Check size={11} aria-hidden="true" /></span>
                  {o.id === user?.id ? 'Me' : o.name}
                  <small>{o.count}</small>
                </button>
              ))}
            </section>
          )}
          {data && data.statuses.length > 0 && (
            <section className="card sx-facet" data-testid="search-facet-status">
              <h4>Status</h4>
              {data.statuses.map((s) => (
                <button key={s.name} type="button" className="sx-fopt" role="menuitemcheckbox" aria-checked={statuses.includes(s.name)} onClick={() => update({ statuses: toggle(statuses, s.name) }, true)}>
                  <span className="sx-bx"><Check size={11} aria-hidden="true" /></span>
                  {s.name}
                  <small>{s.count}</small>
                </button>
              ))}
            </section>
          )}
          <section className="card sx-hint-card">
            <b>Narrow it down</b>
            <p>Type <code>type:deal</code>, <code>owner:me</code> or <code>status:open</code> in the box. Press <code>/</code> to search from anywhere on this page, or <code>Ctrl K</code> from any page.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
