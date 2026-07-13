import { TaskDetailSkeleton } from '@/components/tasks/detail/TaskDetailSkeleton';

export function MobileTaskView({ onBack }: { onBack: () => void }) {
  return (
    <div className="mobile-task-page">
      <header className="mobile-task-head">
        <button type="button" className="link back-link" onClick={onBack}>
          ← Back to tasks
        </button>
        <div className="mobile-task-kicker">Task details</div>
      </header>

      <main className="mobile-task-body">
        <TaskDetailSkeleton />
      </main>
    </div>
  );
}