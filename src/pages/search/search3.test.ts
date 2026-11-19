import { describe, expect, it } from 'vitest';
import {
  agoText, groupHits, highlightParts, hitActions, hitPath, isActionQuery, matchActions, matchLine, resultsPagePath, searchUrl, splitTokens,
  type SearchHit,
} from './searchLogic';

const hit = (over: Partial<SearchHit>): SearchHit => ({
  type: 'lead', id: 'lead-1', ref: '', title: 'Rhea Kapoor', sub: 'Kapoor Exports', ownerId: 'user-2', ownerName: 'Riya Rep', status: 'New',
  at: new Date().toISOString(), amount: null, matchedIn: 'Name', matchedValue: '', score: 60, fields: [], ...over,
});

describe('search 3.0 logic', () => {
  it('marks every searched word, ignoring case and one-letter words', () => {
    expect(highlightParts('Kapoor Exports Pvt', 'kapoor pvt a')).toEqual([
      { text: 'Kapoor', hit: true }, { text: ' Exports ', hit: false }, { text: 'Pvt', hit: true },
    ]);
    expect(highlightParts('a+b (c)', '+b (c')).toEqual([{ text: 'a', hit: false }, { text: '+b', hit: true }, { text: ' ', hit: false }, { text: '(c', hit: true }, { text: ')', hit: false }]);
    expect(highlightParts('Plain', '')).toEqual([{ text: 'Plain', hit: false }]);
  });

  it('opens each type on its own page; meetings and tasks open their form, or the list for viewers', () => {
    expect(hitPath({ type: 'ticket', id: 't1' }, 'rep')).toBe('/tickets/t1');
    expect(hitPath({ type: 'quote', id: 'q1' }, 'viewer')).toBe('/quotes/q1');
    expect(hitPath({ type: 'meeting', id: 'm1' }, 'rep')).toBe('/calendar/m1/edit');
    expect(hitPath({ type: 'meeting', id: 'm1' }, 'viewer')).toBe('/calendar');
    expect(hitPath({ type: 'task', id: 'k1' }, 'admin')).toBe('/tasks/k1/edit');
    expect(hitPath({ type: 'task', id: 'k1' }, 'viewer')).toBe('/tasks');
  });

  it('offers at most two extra actions, and none to viewers', () => {
    expect(hitActions({ type: 'account', id: 'a1' }, 'rep').map((a) => a.label)).toEqual(['Log activity', 'New deal']);
    expect(hitActions({ type: 'account', id: 'a1' }, 'rep')[0].to).toBe('/activity/new?record=accounts:a1');
    expect(hitActions({ type: 'product', id: 'p1' }, 'admin').map((a) => a.to)).toEqual(['/quotes/new?product=p1', '/products/p1/edit']);
    expect(hitActions({ type: 'account', id: 'a1' }, 'viewer')).toEqual([]);
  });

  it('lists actions after ">", filtered by what follows, and only open-a-page ones for viewers', () => {
    expect(isActionQuery('  > new')).toBe(true);
    expect(isActionQuery('kapoor')).toBe(false);
    expect(matchActions('> new t', 'rep').map((a) => a.label)).toEqual(['New ticket', 'New task']);
    expect(matchActions('>', 'viewer').map((a) => a.label)).toEqual(['Open my tasks']);
    expect(matchActions('> calendar', 'rep').map((a) => a.label)).toEqual(['Book a meeting']);
  });

  it('separates filter tokens from words', () => {
    expect(splitTokens('kapoor type:ticket  owner:me status:"in progress" exports')).toEqual({
      tokens: ['type:ticket', 'owner:me', 'status:"in progress"'], plain: 'kapoor exports',
    });
  });

  it('groups hits in the fixed type order and keeps each group ranked', () => {
    const groups = groupHits([hit({ id: 'd1', type: 'deal' }), hit({ id: 'l1' }), hit({ id: 'd2', type: 'deal' })]);
    expect(groups.map((g) => [g.type, g.hits.map((h) => h.id)])).toEqual([['lead', ['l1']], ['deal', ['d1', 'd2']]]);
  });

  it('says where a match was found only when it was not the name', () => {
    expect(matchLine(hit({}))).toBeNull();
    expect(matchLine(hit({ matchedIn: 'GSTIN', matchedValue: '27AAKPK' }))).toEqual({ label: 'GSTIN', value: '27AAKPK' });
  });

  it('writes relative days both ways', () => {
    const now = new Date(2026, 10, 19, 12).getTime();
    expect(agoText(new Date(2026, 10, 19, 8).toISOString(), now)).toBe('Today');
    expect(agoText(new Date(2026, 10, 18, 23).toISOString(), now)).toBe('Yesterday');
    expect(agoText(new Date(2026, 10, 16).toISOString(), now)).toBe('3 days ago');
    expect(agoText(new Date(2026, 10, 20).toISOString(), now)).toBe('Tomorrow');
    expect(agoText(new Date(2026, 10, 23).toISOString(), now)).toBe('In 4 days');
    expect(agoText(new Date(2026, 9, 2).toISOString(), now)).toBe('2 Oct');
  });

  it('builds the API and page addresses', () => {
    expect(searchUrl({ q: 'kapoor exports', types: ['lead', 'deal'], owners: ['user-2'], page: 2, pageSize: 60 })).toBe(
      '/search?q=kapoor+exports&types=lead%2Cdeal&owners=user-2&page=2&pageSize=60'
    );
    expect(searchUrl({ q: 'x y', page: 1 })).toBe('/search?q=x+y');
    expect(resultsPagePath(' TK-0010 ', 'ticket')).toBe('/search?q=TK-0010&types=ticket');
  });
});
