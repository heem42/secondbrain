import { useTasks } from '@/api/hooks';
import { TaskDetail } from '@/components/tasks/detail/TaskDetail';

export function MobileTaskView({
  listId,
  selectedTaskId,
  onBack,
}: {
  listId: string;
  selectedTaskId: string;
  onBack: () => void;
}) {
  const tasksQuery = useTasks(listId);
  const selectedTask = (tasksQuery.data ?? []).find((task) => task.id === selectedTaskId);

  return (
    <div className="mobile-task-page">
      <header className="mobile-task-head">
        <button type="button" className="link back-link" onClick={onBack}>
          ← Back to tasks
        </button>
        <div className="mobile-task-kicker">Task details</div>
      </header>

      <main className="mobile-task-body">
        {selectedTask ? <TaskDetail task={selectedTask} /> : <p className="muted">Loading task details…</p>}
      </main>
    </div>
  );
}
