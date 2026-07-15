import type { TaskList } from '@/api/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobileTaskView } from '@/components/tasks/mobile/MobileTaskView';
import { TaskWorkspace } from '@/components/tasks/workspace/TaskWorkspace';

export function TaskShell({
  list,
  selectedTaskId,
  onSelectTask,
}: {
  list: TaskList;
  selectedTaskId: string | undefined;
  onSelectTask: (taskId: string | undefined) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile && selectedTaskId) {
    return (
      <MobileTaskView
        listId={list.id}
        selectedTaskId={selectedTaskId}
        onBack={() => onSelectTask(undefined)}
      />
    );
  }

  return (
    <TaskWorkspace
      list={list}
      selectedTaskId={selectedTaskId}
      onSelectTask={onSelectTask}
    />
  );
}
