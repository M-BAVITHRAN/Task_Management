import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const blankTask = { title: '', description: '', status: 'pending', dueDate: '' };
const filters = [
  { value: 'all', label: 'All tasks' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' }
];

function dateLabel(date) {
  if (!date) return 'No due date';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'No due date' : `Due ${parsed.toLocaleDateString()}`;
}

export default function App() {
  // Token intentionally stays in memory; refreshing the page signs the user out.
  const [session, setSession] = useState(() => {
  try {
    const savedSession = localStorage.getItem('taskflow_session');
    return savedSession ? JSON.parse(savedSession) : null;
  } catch {
    localStorage.removeItem('taskflow_session');
    return null;
  }
});
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState(blankTask);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTasks = useCallback(async (token) => {
    setLoading(true);
    try {
      const data = await api('/tasks', { token });
      setTasks(data.tasks);
      setError('');
    } catch (err) {
      setError(err.message);
      if (/token|sign in|authentication/i.test(err.message)) {
        setSession(null);
        setTasks([]);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (session?.token) loadTasks(session.token);
  }, [session, loadTasks]);

  const visibleTasks = useMemo(() => tasks.filter(task => {
    const matchesStatus = filter === 'all' || task.status === filter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || task.title.toLowerCase().includes(term) || (task.description || '').toLowerCase().includes(term);
    return matchesStatus && matchesQuery;
  }), [tasks, filter, query]);

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    progress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  }), [tasks]);

  async function submitAuth(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const payload = authMode === 'register'
        ? authForm
        : { email: authForm.email, password: authForm.password };
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      setSession(data);
      setAuthForm({ name: '', email: '', password: '' });
      setNotice(authMode === 'register' ? 'Account created. Welcome!' : 'Signed in successfully.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function signOut() {
    setSession(null); setTasks([]); setTaskForm(blankTask); setEditingId(null);
    setError(''); setNotice('You have signed out.');
  }

  async function submitTask(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      status: taskForm.status,
      dueDate: taskForm.dueDate || null
    };
    try {
      if (editingId) {
        await api(`/tasks/${editingId}`, { token: session.token, method: 'PUT', body: JSON.stringify(payload) });
        setNotice('Task updated successfully.');
      } else {
        await api('/tasks', { token: session.token, method: 'POST', body: JSON.stringify(payload) });
        setNotice('Task created successfully.');
      }
      setTaskForm(blankTask); setEditingId(null);
      await loadTasks(session.token);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function startEdit(task) {
    setEditingId(task._id);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''
    });
    setError(''); setNotice('');
    document.getElementById('task-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    setError(''); setNotice('');
    try {
      await api(`/tasks/${task._id}`, { token: session.token, method: 'DELETE' });
      setTasks(old => old.filter(item => item._id !== task._id));
      if (editingId === task._id) { setEditingId(null); setTaskForm(blankTask); }
      setNotice('Task deleted.');
    } catch (err) { setError(err.message); }
  }

  async function changeStatus(task, status) {
    setError(''); setNotice('');
    try {
      const data = await api(`/tasks/${task._id}`, {
        token: session.token, method: 'PUT', body: JSON.stringify({ status })
      });
      setTasks(old => old.map(item => item._id === task._id ? data.task : item));
      setNotice('Task status updated.');
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TaskFlow home"><span className="brand-mark">✓</span> TaskFlow</a>
        {session ? <div className="profile"><span className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</span><span className="profile-name">{session.user.name}</span><button className="button button-quiet button-small" onClick={signOut}>Sign out</button></div> : <span className="topbar-note">Your day, organized.</span>}
      </header>

      {!session ? (
        <main className="auth-layout" id="top">
          <section className="welcome-panel">
            <span className="eyebrow">MAKE SPACE FOR YOUR BEST WORK</span>
            <h1>Less busy.<br /><span>More done.</span></h1>
            <p>One clear place for your tasks, priorities, and progress.</p>
            <div className="welcome-points"><span>✓ Keep tasks organized</span><span>✓ Track your progress</span><span>✓ Stay focused on what matters</span></div>
            <div className="decor-card"><div className="decor-check">✓</div><div><strong>Small steps add up.</strong><p>Make today count, one task at a time.</p></div></div>
          </section>
          <section className="auth-card">
            <div className="auth-tabs"><button className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setError(''); }}>Sign in</button><button className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setError(''); }}>Create account</button></div>
            <h2>{authMode === 'login' ? 'Welcome back' : 'Get started for free'}</h2>
            <p className="muted">{authMode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account to manage your tasks.'}</p>
            <form className="stack-form" onSubmit={submitAuth}>
              {authMode === 'register' && <label>Full name<input autoComplete="name" required minLength={2} maxLength={80} value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Your name" /></label>}
              <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
              <label>Password<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={72} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" /></label>
              {error && <p className="alert alert-error" role="alert">{error}</p>}
              {notice && <p className="alert alert-success" role="status">{notice}</p>}
              <button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in →' : 'Create account →'}</button>
            </form>
            <p className="auth-footnote">Your account and tasks are private to you.</p>
          </section>
        </main>
      ) : (
        <main className="dashboard" id="top">
          <section className="dashboard-heading"><div><span className="eyebrow">YOUR PERSONAL WORKSPACE</span><h1>Good things get <span>done.</span></h1><p className="muted">Here’s what’s happening with your tasks.</p></div><button className="button button-primary" onClick={() => { setEditingId(null); setTaskForm(blankTask); document.getElementById('task-title')?.focus(); document.getElementById('task-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>＋ New task</button></section>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {notice && <p className="alert alert-success" role="status">{notice}</p>}
          <section className="stats-grid" aria-label="Task summary">
            <div className="stat-card"><span className="stat-icon purple">▤</span><span className="stat-label">Total tasks</span><strong>{counts.all}</strong><span className="stat-foot">In your workspace</span></div>
            <div className="stat-card"><span className="stat-icon amber">◷</span><span className="stat-label">Pending</span><strong>{counts.pending}</strong><span className="stat-foot">Ready to get started</span></div>
            <div className="stat-card"><span className="stat-icon blue">↗</span><span className="stat-label">In progress</span><strong>{counts.progress}</strong><span className="stat-foot">Work in motion</span></div>
            <div className="stat-card"><span className="stat-icon green">✓</span><span className="stat-label">Completed</span><strong>{counts.completed}</strong><span className="stat-foot">Nice work!</span></div>
          </section>
          <div className="content-grid">
            <section className="panel task-panel"><div className="panel-heading"><div><h2>Your tasks</h2><p className="muted">A little progress every day.</p></div><span className="count-pill">{visibleTasks.length} shown</span></div>
              <div className="task-controls"><input aria-label="Search tasks" className="search-input" placeholder="⌕  Search tasks…" value={query} onChange={e => setQuery(e.target.value)} /><div className="filter-row" aria-label="Filter tasks">{filters.map(item => <button key={item.value} className={`filter-button ${filter === item.value ? 'selected' : ''}`} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div></div>
              {loading ? <div className="empty-state"><div className="spinner"/><p>Loading your tasks…</p></div> : visibleTasks.length === 0 ? <div className="empty-state"><div className="empty-icon">✓</div><h3>{tasks.length === 0 ? 'A fresh start' : 'No tasks found'}</h3><p>{tasks.length === 0 ? 'Add your first task and turn your plans into progress.' : 'Try another search or filter.'}</p></div> : <div className="task-list">{visibleTasks.map(task => <article className="task-item" key={task._id}><div className={`task-status-dot ${task.status}`} aria-hidden="true"/><div className="task-copy"><h3 className={task.status === 'completed' ? 'completed-title' : ''}>{task.title}</h3>{task.description && <p>{task.description}</p>}<div className="task-meta"><span className={`status-badge ${task.status}`}>{task.status === 'in-progress' ? 'In progress' : task.status[0].toUpperCase() + task.status.slice(1)}</span><span className="due-date">◷ {dateLabel(task.dueDate)}</span></div></div><div className="task-actions"><select aria-label={`Change status for ${task.title}`} value={task.status} onChange={e => changeStatus(task, e.target.value)}><option value="pending">Pending</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select><button className="icon-button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => startEdit(task)}>✎</button><button className="icon-button danger" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => deleteTask(task)}>×</button></div></article>)}</div>}
            </section>
            <aside className="panel editor-panel" id="task-editor"><div className="panel-heading"><div><h2>{editingId ? 'Edit task' : 'Create a task'}</h2><p className="muted">{editingId ? 'Update the details below.' : 'Write it down. Make it happen.'}</p></div>{editingId && <button className="text-button" onClick={() => { setEditingId(null); setTaskForm(blankTask); }}>Cancel</button>}</div>
              <form className="stack-form task-form" onSubmit={submitTask}><label>Task title <span className="required">*</span><input id="task-title" required maxLength={120} value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Finish project report" /></label><label>Description <span className="optional">(optional)</span><textarea rows={4} maxLength={2000} value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Add a few details…" /></label><label>Status<select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}><option value="pending">Pending</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select></label><label>Due date <span className="optional">(optional)</span><input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></label><button className="button button-primary button-full" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes →' : 'Create task →'}</button></form>
            </aside>
          </div>
          <footer className="dashboard-footer">Made for focus, built for progress. <span>TaskFlow</span></footer>
        </main>
      )}
    </div>
  );
}
