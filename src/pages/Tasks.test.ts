import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TaskItem } from '../types';
import { canManageTasks, TaskEmptyState, TaskRows } from './Tasks';

const tasks: TaskItem[] = [
  { id: 'task-1', title: 'Call Calder Logistics', dueDate: '2099-11-09T00:00:00.000Z', priority: 'High', completed: false, order: 0 },
  { id: 'task-2', title: 'Review Tidewater audit', dueDate: '2099-11-12T00:00:00.000Z', priority: 'Medium', completed: false, order: 1 },
];

function renderRows(role: 'admin' | 'rep' | 'viewer', filter: 'all' | 'open' = 'all'): string {
  const canManage = canManageTasks(role);
  return renderToStaticMarkup(createElement(TaskRows, {
    tasks,
    filter,
    canManage,
    reordering: false,
    onToggleComplete: vi.fn(),
    onDelete: vi.fn(),
    onChangePriority: vi.fn(),
    onMove: vi.fn(),
    onDragStart: vi.fn(),
    onDrop: vi.fn(),
  }));
}

describe('Tasks role and filter controls', () => {
  it('allows admins and reps to manage tasks but keeps viewers read-only', () => {
    expect(canManageTasks('admin')).toBe(true);
    expect(canManageTasks('rep')).toBe(true);
    expect(canManageTasks('viewer')).toBe(false);
    expect(canManageTasks(undefined)).toBe(false);
  });

  it('puts the checkbox before the All-view reorder controls and delete action', () => {
    const html = renderRows('admin');
    const checkbox = html.indexOf('aria-label="Complete Call Calder Logistics"');
    const moveUp = html.indexOf('aria-label="Move Call Calder Logistics up"');
    const moveDown = html.indexOf('aria-label="Move Call Calder Logistics down"');
    const delete = html.indexOf('aria-label="Delete Call Calder Logistics"');
    expect(checkbox).toBeGreaterThan(-1);
    expect(checkbox).toBeLessThan(moveUp);
    expect(moveUp).toBeLessThan(moveDown);
    expect(moveDown).toBeLessThan(delete);
  });

  it('omits reorder controls from filtered editors', () => {
    const html = renderRows('rep', 'open');
    expect(html).toContain('aria-label="Complete Call Calder Logistics"');
    expect(html).toContain('aria-label="Delete Call Calder Logistics"');
    expect(html).not.toContain('drag-handle');
    expect(html).not.toContain('Move Call Calder Logistics');
  });

  it('renders viewers without change controls or a priority editor', () => {
    const html = renderRows('viewer');
    expect(html).toContain('High priority');
    expect(html).not.toContain('<input type="checkbox"');
    expect(html).not.toContain('aria-label="Delete');
    expect(html).not.toContain('Move Call Calder Logistics');
    expect(html).not.toContain('aria-haspopup="listbox"');
  });

  it('gives an editor an add-task action and a viewer read-only guidance when All is empty', () => {
    const editor = renderToStaticMarkup(createElement(TaskEmptyState, {
      filter: 'all',
      canManage: true,
      onAction: vi.fn(),
    }));
    const viewer = renderToStaticMarkup(createElement(TaskEmptyState, {
      filter: 'all',
      canManage: false,
      onAction: vi.fn(),
    }));
    expect(editor).toContain('No tasks yet');
    expect(editor).toContain('Add a task to start your list.');
    expect(editor).toContain('>Add a task</button>');
    expect(viewer).toContain('Ask a team member to add a task.');
    expect(viewer).not.toContain('<button');
  });

  it('provides a next step for each filtered empty state', () => {
    const cases: { filter: 'open' | 'today' | 'completed' | 'overdue'; title: string; action: string }[] = [
      { filter: 'open', title: 'No open tasks', action: 'Show completed tasks' },
      { filter: 'today', title: 'No tasks due today', action: 'Show all tasks' },
      { filter: 'completed', title: 'No completed tasks', action: 'Show open tasks' },
      { filter: 'overdue', title: 'No overdue tasks', action: 'Show all tasks' },
    ];
    for (const { filter, title, action } of cases) {
      const html = renderToStaticMarkup(createElement(TaskEmptyState, {
        filter,
        canManage: false,
        onAction: vi.fn(),
      }));
      expect(html).toContain(title);
      expect(html).toContain(`>${action}</button>`);
    }
  });
});
