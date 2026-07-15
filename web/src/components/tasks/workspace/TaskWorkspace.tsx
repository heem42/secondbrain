import { useState, type FormEvent } from 'react';
import { useCreateTask, useTasks } from '@/api/hooks';
import type { TaskList } from '@/api/types';
import { TaskDetailSkeleton } from '@/components/tasks/detail/TaskDetailSkeleton';
import { TaskRow } from '@/components/tasks/workspace/TaskRow';

export function TaskWorkspace({
  list,
  selectedTaskId,
  onSelectTask,
}: {
  list: TaskList;
  selectedTaskId: string | undefined;
  onSelectTask: (taskId: string | undefined) => void;
}) {
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
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  return (
    <div
      className={`task-workspace ${selectedTaskId ? 'task-workspace-with-detail' : 'task-workspace-no-detail'}`}
    >
      <section className="task-panel">
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
              <TaskRow
                key={task.id}
                task={task}
                listId={list.id}
                isSelected={task.id === selectedTaskId}
                onOpen={() => onSelectTask(task.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {selectedTaskId ? (
        <aside className="task-detail-pane" aria-label="Task detail">
          {selectedTask ? (
            <TaskDetailSkeleton task={selectedTask} />
          ) : (
            <p className="muted">Loading task details…</p>
          )}
        </aside>
      ) : null}
    </div>
  );
}
