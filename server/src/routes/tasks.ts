import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { taskSchema } from '../schemas/task.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { TaskItem } from '../types.js';
import { recordSystemActivity } from './activities.js';

function buildTask(body: any): TaskItem {
  return {
    id: body.id ?? newId('task'),
    title: body.title,
    dueDate: body.dueDate,
    priority: body.priority ?? 'Medium',
    completed: body.completed ?? false,
    order: body.order ?? 0,
    ownerId: body.ownerId ?? null,
    dueTime: body.dueTime ?? null,
    recordModule: body.recordId ? body.recordModule ?? null : null,
    recordId: body.recordId ?? null,
  };
}

export const tasksRouter: Router = crudRouter<TaskItem>({
  collection: store.tasks,
  entityLabel: 'Task',
  auditAction: 'task',
  createSchema: taskSchema,
  // A new task belongs to whoever adds it unless they give it to someone else.
  buildCreate: (body, req) => ({ ...buildTask(body), ownerId: body.ownerId ?? req.user?.id ?? null }),
  buildUpdate: (body, id, req) => {
    const existing = store.tasks.get(id);
    const task = { ...buildTask(body), id };
    if (existing && !existing.completed && task.completed) {
      recordSystemActivity(req, 'Task done', `${req.user?.name ?? 'Someone'} completed the task “${task.title}”`, task.recordModule, task.recordId);
    }
    return task;
  },
  describe: (t) => t.title,
});

tasksRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const task = store.tasks.get(req.params.id);
  if (!task) throw notFound('Task');
  store.tasks.remove(task.id);
  res.status(204).end();
});
