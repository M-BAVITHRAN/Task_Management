const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
const allowedStatuses = ['pending', 'in-progress', 'completed'];

function toApiTask(row) {
  if (!row) return null;
  return {
    _id: String(row.id),
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    owner: String(row.owner_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function parseTaskBody(body, partial = false) {
  const result = {};
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) {
      return { error: 'Title is required and must be at most 120 characters.' };
    }
    result.title = body.title.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.length > 2000) return { error: 'Description must be at most 2000 characters.' };
    result.description = body.description.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!allowedStatuses.includes(body.status)) return { error: 'Status must be pending, in-progress, or completed.' };
    result.status = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    if (body.dueDate === '' || body.dueDate === null) result.dueDate = null;
    else {
      const date = new Date(body.dueDate);
      if (Number.isNaN(date.getTime())) return { error: 'Due date must be a valid date.' };
      result.dueDate = date.toISOString().slice(0, 10);
    }
  }
  return { value: result };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE owner_id = ? ORDER BY created_at DESC, id DESC').all(Number(req.user.id));
  res.json({ tasks: rows.map(toApiTask) });
});

router.post('/', (req, res) => {
  const parsed = parseTaskBody(req.body || {});
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const { title, description = '', status = 'pending', dueDate = null } = parsed.value;
  const result = db.prepare(`INSERT INTO tasks (title, description, status, due_date, owner_id)
    VALUES (?, ?, ?, ?, ?)`).run(title, description, status, dueDate, Number(req.user.id));
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?').get(result.lastInsertRowid, Number(req.user.id));
  res.status(201).json({ task: toApiTask(row) });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ message: 'Task not found.' });
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?').get(id, Number(req.user.id));
  if (!row) return res.status(404).json({ message: 'Task not found.' });
  res.json({ task: toApiTask(row) });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ message: 'Task not found.' });
  const parsed = parseTaskBody(req.body || {}, true);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const fields = Object.entries(parsed.value);
  if (!fields.length) return res.status(400).json({ message: 'Provide at least one field to update.' });
  const columns = { title: 'title', description: 'description', status: 'status', dueDate: 'due_date' };
  const assignments = fields.map(([key]) => `${columns[key]} = ?`);
  const values = fields.map(([, value]) => value);
  assignments.push("updated_at = datetime('now')");
  const result = db.prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ? AND owner_id = ?`).run(...values, id, Number(req.user.id));
  if (!result.changes) return res.status(404).json({ message: 'Task not found.' });
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?').get(id, Number(req.user.id));
  res.json({ task: toApiTask(row) });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ message: 'Task not found.' });
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND owner_id = ?').run(id, Number(req.user.id));
  if (!result.changes) return res.status(404).json({ message: 'Task not found.' });
  res.json({ message: 'Task deleted successfully.' });
});

module.exports = router;
