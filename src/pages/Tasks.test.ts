import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Meeting, TaskItem } from '../types';
import { canManageTasks, DayBand, TaskRow } from './Tasks';

const today = new Date(2026, 10, 17, 14, 20);
const at = (days: number, hour = 12) => new Date(2026, 10, 17 + days, hour).toISOString();
const task = (over: Partial<TaskItem> = {}): TaskItem => ({ id: 'task-1', title: 'Call Calder Logistics', dueDate: at(0), priority: 'High', completed: false, order: 0, ...over });

function row(over: Partial<Parameters<typeof TaskRow>[0]> = {}): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TaskRow, {
    task: task(),
    canManage: true,
    ticking: false,
    landed: false,
    delay: 0,
    canMoveUp: true,
    canMoveDown: true,
    onTick: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    ...over,
  })));
}

describe('Tasks roles', () => {
  it('lets admins and reps manage tasks and keeps viewers read-only', () => {
    expect(canManageTasks('admin')).toBe(true);
    expect(canManageTasks('rep')).toBe(true);
    expect(canManageTasks('viewer')).toBe(false);
    expect(canManageTasks(undefined)).toBe(false);
  });
});

describe('TaskRow', () => {
  it('puts the tick first, then move up, move down, edit and delete', () => {
    const html = row();
    const order = ['Complete Call Calder Logistics', 'Move Call Calder Logistics up', 'Move Call Calder Logistics down', 'Edit Call Calder Logistics', 'Delete Call Calder Logistics']
      .map((label) => html.indexOf(`aria-label="${label}"`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('shows the priority and links the customer the task is for', () => {
    const html = row({ target: { module: 'contacts', id: 'c1', name: 'Kavya Anand' } });
    expect(html).toContain('High priority');
    expect(html).toContain('href="/contacts/c1"');
    expect(html).toContain('Kavya Anand');
  });

  it('gives viewers a disabled tick and no change controls', () => {
    const html = row({ canManage: false });
    expect(html).toMatch(/aria-label="Complete Call Calder Logistics"[^>]*disabled=""|disabled=""[^>]*aria-label="Complete Call Calder Logistics"/);
    expect(html).not.toContain('aria-label="Delete');
    expect(html).not.toContain('aria-label="Edit');
    expect(html).not.toContain('Move Call Calder Logistics');
  });

  it('marks a finished task as done and drops the reorder buttons', () => {
    const html = row({ task: task({ completed: true }) });
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('act-trow done');
    expect(html).not.toContain('Move Call Calder Logistics');
  });
});

describe('DayBand', () => {
  const meeting: Meeting = {
    id: 'm1', title: 'Credit committee', type: 'Meeting', start: at(0, 16), durationMin: 60, ownerId: 'u1', attendeeIds: ['u1'], contactIds: [],
    location: '', reminder: '', notes: '', createdAt: at(-3),
  };
  it('counts today’s done tasks and overdue ones, and names the next meeting', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(DayBand, {
      tasks: [task(), task({ id: 't2', completed: true }), task({ id: 't3', dueDate: at(-2) })],
      meetings: [meeting],
      now: today,
    })));
    expect(html).toContain('1 of 2');
    expect(html).toContain('1 overdue');
    expect(html).toContain('Next: <b>Credit committee</b> at 16:00');
  });
});
