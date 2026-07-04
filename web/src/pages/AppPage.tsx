import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  useCreateTask,
  useDeleteTask,
  useLists,
  useTasks,
  useToggleTask,
  useUpdateTask,
} from '../api/hooks';
import type { Task, TaskList } from '../api/types';

export function AppPage() {
  const { user, logout } = useAuth();
  const listsQuery = useLists();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  // Default the selection to the Inbox (or the first list) once lists load.
  useEffect(() => {
    if (!selectedId && listsQuery.data?.length) {
      const inbox = listsQuery.data.find((l) => l.isInbox) ?? listsQuery.data[0];
      setSelectedId(inbox.id);
    }
  }, [listsQuery.data, selectedId]);

  const selected = listsQuery.data?.find((l) => l.id === selectedId);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">Lists</div>
        <nav>
          {listsQuery.data?.map((list) => (
            <button
              key={list.id}
              className={`list-row ${list.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(list.id)}
            >
              <span className="list-icon">{list.isInbox ? '📥' : '📋'}</span>
              {list.name}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="user-email">{user?.email}</span>
          <button className="link" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        {selected ? (
          <TaskPanel list={selected} />
        ) : (
          <div className="empty">Select a list</div>
        )}
      </main>
    </div>
  );
}

function TaskPanel({ list }: { list: TaskList }) {
  const tasksQuery = useTasks(list.id);
  const createTask = useCreateTask(list.id);
  const [title, setTitle] = useState('');

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    createTask.mutate(trimmed);
  }

  const tasks = tasksQuery.data ?? [];

  return (
    <div className="task-panel">
      <h2 className="panel-title">{list.name}</h2>

      <form className="add-row" onSubmit={onAdd}>
        <span className="plus">＋</span>
        <input
          placeholder="Add a task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </form>

      {tasksQuery.isLoading ? (
        <p className="muted">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="muted">No tasks yet</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} listId={list.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, listId }: { task: Task; listId: string }) {
  const toggle = useToggleTask(listId);
  const update = useUpdateTask(listId);
  const remove = useDeleteTask(listId);
  const done = task.status === 'done';

  function rename() {
    const next = window.prompt('Rename task', task.title);
    if (next && next.trim() && next.trim() !== task.title) {
      update.mutate({ id: task.id, title: next.trim(), priority: task.priority });
    }
  }

  function cyclePriority() {
    const order = ['none', 'low', 'medium', 'high'] as const;
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    update.mutate({ id: task.id, title: task.title, priority: next });
  }

  return (
    <li className={`task-row ${done ? 'done' : ''}`}>
      <button
        className="check"
        aria-label={done ? 'Mark not done' : 'Mark done'}
        onClick={() => toggle.mutate(task)}
      >
        {done ? '☑' : '☐'}
      </button>
      <span className="task-title" onDoubleClick={rename} title="Double-click to rename">
        {task.title}
      </span>
      <button
        className={`prio prio-${task.priority}`}
        onClick={cyclePriority}
        title="Cycle priority"
      >
        {task.priority === 'none' ? '—' : task.priority}
      </button>
      <button
        className="delete"
        aria-label="Delete task"
        onClick={() => remove.mutate(task.id)}
      >
        ✕
      </button>
    </li>
  );
}
