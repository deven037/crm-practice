import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { taskSchema } from '../schemas/task.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { TaskItem } from '../types.js';

function buildTask(body: any): TaskItem {
  return {
    id: body.id ?? newId('task'),
    title: body.title,
    dueDate: body.dueDate,
    priority: body.priority ?? 'Medium',
    completed: body.completed ?? false,
    order: body.order ?? 0,
  };
}

export const tasksRouter: Router = crudRouter<TaskItem>({
  collection: store.tasks,
  entityLabel: 'Task',
  auditAction: 'task',
  createSchema: taskSchema,
  buildCreate: (body) => buildTask(body),
  buildUpdate: (body, id) => ({ ...buildTask(body), id }),
  describe: (t) => t.title,
});

tasksRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const task = store.tasks.get(req.params.id);
  if (!task) throw notFound('Task');
  store.tasks.remove(task.id);
  res.status(204).end();
});
