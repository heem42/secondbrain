export function TaskDetailSkeleton() {
  return (
    <div className="task-detail-skeleton">
      <div className="detail-line detail-line-lg" />
      <div className="detail-row">
        <span className="detail-label">Due date</span>
        <div className="detail-value detail-line" />
      </div>
      <div className="detail-row">
        <span className="detail-label">Description</span>
        <div className="detail-card detail-card-lg" />
      </div>
      <div className="detail-grid">
        <div className="detail-card" />
        <div className="detail-card" />
      </div>
    </div>
  );
}