import { useDeleteTask, useToggleTask, useUpdateTask } from '@/api/hooks';
import type { Task } from '@/api/types';

export function TaskRow({
  task,
  listId,
  isSelected,
  onOpen,
}: {
  task: Task;
  listId: string;
  isSelected: boolean;
  onOpen: () => void;
}) {
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
    <li className={`task-row ${done ? 'done' : ''} ${isSelected ? 'selected' : ''}`}>
      <button
        type="button"
        className="check"
        aria-label={done ? 'Mark not done' : 'Mark done'}
        onClick={() => toggle.mutate(task)}
      >
        {done ? '☑' : '☐'}
      </button>
      <button
        type="button"
        className="task-title task-open"
        onClick={onOpen}
        onDoubleClick={rename}
        title="Open task details"
      >
        {task.title}
      </button>
      <button
        type="button"
        className={`prio prio-${task.priority}`}
        onClick={cyclePriority}
        title="Cycle priority"
      >
        {task.priority === 'none' ? '—' : task.priority}
      </button>
      <button
        type="button"
        className="delete"
        aria-label="Delete task"
        onClick={() => remove.mutate(task.id)}
      >
        ✕
      </button>
    </li>
  );
}