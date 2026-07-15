import type { Task } from '@/api/types';

function formatDate(value: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleString();
}

export function TaskDetail({ task }: { task: Task }) {
  return (
    <div className="task-detail task-detail-content">
      <div className="detail-title">{task.title}</div>
      <div className="detail-row">
        <span className="detail-label">Due date</span>
        <div className="detail-value-text">{formatDate(task.dueAt)}</div>
      </div>
      <div className="detail-row">
        <span className="detail-label">Description</span>
        <div className="detail-card detail-card-lg">
          <span className="detail-card-text">{task.notes?.trim() || 'No description'}</span>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-card">
          <div className="detail-label">Status</div>
          <div className="detail-card-text">{task.status.replace('_', ' ')}</div>
        </div>
        <div className="detail-card">
          <div className="detail-label">Priority</div>
          <div className="detail-card-text">{task.priority === 'none' ? 'None' : task.priority}</div>
        </div>
      </div>
    </div>
  );
}
