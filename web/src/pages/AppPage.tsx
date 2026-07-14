import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useLists } from '@/api/hooks';
import { TaskShell } from '@/components/tasks';

export function AppPage() {
  const { user, logout } = useAuth();
  const listsQuery = useLists();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();

  // Default the selection to the Inbox (or the first list) once lists load.
  useEffect(() => {
    if (!selectedId && listsQuery.data?.length) {
      const inbox = listsQuery.data.find((l) => l.isInbox) ?? listsQuery.data[0];
      setSelectedId(inbox.id);
    }
  }, [listsQuery.data, selectedId]);

  useEffect(() => {
    setSelectedTaskId(undefined);
  }, [selectedId]);

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
          <TaskShell
            list={selected}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />
        ) : (
          <div className="empty">Select a list</div>
        )}
      </main>
    </div>
  );
}
