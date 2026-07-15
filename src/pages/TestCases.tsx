import { useMemo, useState } from 'react';
import { CATALOG_INTRO, TEST_CATALOG } from '../data/testCatalog';
import { classNames } from '../utils';

const TAGS = ['Smoke', 'Sanity', 'Regression', 'Feature', 'E2E'];

const TAG_PILL: Record<string, string> = {
  Smoke: 'pill-overdue',
  Sanity: 'status-contacted',
  Regression: 'status-new',
  Feature: 'status-qualified',
  E2E: 'status-converted',
};

const ALL_CASES = TEST_CATALOG.flatMap((m) => m.cases);
const TOTAL_STEPS = ALL_CASES.reduce((n, c) => n + c.steps.length, 0);

export function TestCases() {
  const [tagFilter, setTagFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const countFor = (tag: string) =>
    tag === 'All' ? ALL_CASES.length : ALL_CASES.filter((c) => c.tags.includes(tag)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEST_CATALOG.map((mod) => ({
      ...mod,
      cases: mod.cases.filter((c) => {
        if (tagFilter !== 'All' && !c.tags.includes(tagFilter)) return false;
        if (!q) return true;
        return (
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.steps.some(([a, e]) => a.toLowerCase().includes(q) || e.toLowerCase().includes(q))
        );
      }),
    })).filter((mod) => mod.cases.length > 0);
  }, [tagFilter, query]);

  const visibleCount = filtered.reduce((n, m) => n + m.cases.length, 0);

  return (
    <div data-testid="testcases-page">
      <div className="page-header">
        <h1>Test Cases</h1>
        <span className="muted">
          {ALL_CASES.length} cases · {TOTAL_STEPS} steps · {TEST_CATALOG.length} modules
        </span>
      </div>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          The executable specification of this application — for anyone who wants to automate it. Every case lists
          concrete actions with expected results. Suite tags: <span className="pill pill-overdue">Smoke</span> critical
          path, every build · <span className="pill status-contacted">Sanity</span> post-deploy health ·{' '}
          <span className="pill status-new">Regression</span> full coverage ·{' '}
          <span className="pill status-qualified">Feature</span> one feature exercised exhaustively ·{' '}
          <span className="pill status-converted">E2E</span> start-to-finish business journeys.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>{CATALOG_INTRO}</p>
      </div>

      <div className="chip-filters">
        {['All', ...TAGS].map((tag) => (
          <button
            key={tag}
            className={classNames('chip-filter', tagFilter === tag && 'active')}
            onClick={() => setTagFilter(tag)}
          >
            {tag} ({countFor(tag)})
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search id, title, or steps…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted">{visibleCount} case(s) shown</span>
      </div>

      {filtered.length === 0 && <div className="empty-cell">No test cases match.</div>}

      {filtered.map((mod) => (
        <section key={mod.name} className="testcase-module">
          <h3 className="testcase-module-title">
            {mod.name} <span className="badge">{mod.cases.length}</span>
          </h3>
          <div className="testcase-list">
            {mod.cases.map((tc) => {
              const open = openId === tc.id;
              return (
                <div key={tc.id} className={classNames('testcase-card', open && 'open')}>
                  <button className="testcase-head" aria-expanded={open} onClick={() => setOpenId(open ? null : tc.id)}>
                    <span className="accordion-chevron" aria-hidden="true">▸</span>
                    <code className="testcase-id">{tc.id}</code>
                    <span className="testcase-title">{tc.title}</span>
                    <span className="testcase-tags">
                      {tc.tags.map((tag) => (
                        <span key={tag} className={`pill ${TAG_PILL[tag] ?? ''}`}>
                          {tag}
                        </span>
                      ))}
                    </span>
                    <span className="muted testcase-meta">{tc.steps.length} steps</span>
                  </button>
                  {open && (
                    <div className="testcase-body">
                      <table className="table testcase-table">
                        <thead>
                          <tr>
                            <th style={{ width: 36 }}>#</th>
                            <th style={{ width: '46%' }}>Step (Action)</th>
                            <th>Expected Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tc.steps.map(([action, expected], i) => (
                            <tr key={i}>
                              <td className="num">{i + 1}</td>
                              <td>{action}</td>
                              <td>{expected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
