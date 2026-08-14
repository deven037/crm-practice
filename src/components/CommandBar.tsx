import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Clock } from 'lucide-react';
import { getAllSync } from '../data/store';
import { Account, Campaign, Contact, Deal, Lead, Product, Quote } from '../types';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  group: 'Quick actions' | 'Recent' | 'Results';
  onSelect: () => void;
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

function searchAllModules(rawQuery: string, navigate: (to: string) => void): CommandItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];
  const nav = (link: string) => () => navigate(link);
  const results: CommandItem[] = [
    ...getAllSync<Lead>('leads')
      .filter((l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q))
      .slice(0, 4)
      .map((l) => ({ id: `lead-${l.id}`, label: l.name, sublabel: `Lead · ${l.company}`, group: 'Results' as const, onSelect: nav('/leads') })),
    ...getAllSync<Contact>('contacts')
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((c) => ({ id: `contact-${c.id}`, label: c.name, sublabel: 'Contact', group: 'Results' as const, onSelect: nav(`/contacts/${c.id}`) })),
    ...getAllSync<Account>('accounts')
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((a) => ({ id: `account-${a.id}`, label: a.name, sublabel: 'Account', group: 'Results' as const, onSelect: nav(`/accounts/${a.id}`) })),
    ...getAllSync<Product>('products')
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 3)
      .map((p) => ({ id: `product-${p.id}`, label: p.name, sublabel: `Product · ${p.sku}`, group: 'Results' as const, onSelect: nav(`/products/${p.id}`) })),
    ...getAllSync<Deal>('deals')
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((d) => ({ id: `deal-${d.id}`, label: d.name, sublabel: 'Deal', group: 'Results' as const, onSelect: nav(`/deals/${d.id}`) })),
    ...getAllSync<Campaign>('campaigns')
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({ id: `campaign-${c.id}`, label: c.name, sublabel: 'Campaign', group: 'Results' as const, onSelect: nav(`/campaigns/${c.id}`) })),
    ...getAllSync<Quote>('quotes')
      .filter((qt) => qt.quoteNumber.toLowerCase().includes(q))
      .slice(0, 3)
      .map((qt) => ({ id: `quote-${qt.id}`, label: qt.quoteNumber, sublabel: 'Quote', group: 'Results' as const, onSelect: nav(`/quotes/${qt.id}`) })),
  ];
  return results;
}

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

/** Global ⌘K/Ctrl+K command bar — subsumes the topbar search, adds quick-actions + recent records. Controlled by Layout.tsx. */
export function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { items: recent } = useRecentlyViewed();

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const items: CommandItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length >= 2) return searchAllModules(query, navigate);
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

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    items.forEach((item) => {
      groups[item.group] = groups[item.group] ?? [];
      groups[item.group].push(item);
    });
    return groups;
  }, [items]);

  const select = (item: CommandItem) => {
    onClose();
    item.onSelect();
  };

  if (!open) return null;

  return (
    <div className="command-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="command-panel" data-testid="command-bar">
        <div className="command-input-row">
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search or jump to an action…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && items[activeIndex]) {
                select(items[activeIndex]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--text-muted)' }}>Esc</kbd>
        </div>
        <div className="command-list">
          {items.length === 0 && <div className="search-hint">No matches.</div>}
          {(['Quick actions', 'Recent', 'Results'] as const).map((group) =>
            grouped[group] ? (
              <div key={group}>
                <div className="command-group-label">{group}</div>
                {grouped[group].map((item) => {
                  const idx = items.indexOf(item);
                  return (
                    <div
                      key={item.id}
                      className={`command-item${idx === activeIndex ? ' active' : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => select(item)}
                    >
                      {group === 'Quick actions' ? <Plus size={14} /> : group === 'Recent' ? <Clock size={14} /> : null}
                      <span>{item.label}</span>
                      {item.sublabel && <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{item.sublabel}</span>}
                    </div>
                  );
                })}
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
