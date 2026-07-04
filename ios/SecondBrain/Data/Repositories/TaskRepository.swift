import Foundation
import GRDB

/// The only thing that touches the local store for tasks (ARCHITECTURE.md §7), and
/// the orchestrator of the write-through flow (§8): a write is applied to GRDB
/// immediately (optimistic) and then pushed to the API; the server's response is
/// upserted back to reconcile authoritative timestamps.
///
/// Online-first for now — if the push fails the optimistic row stays and the error
/// surfaces. The retry outbox is a later milestone (§10), not built into this.
struct TaskRepository {
    let db: AppDatabase
    let api: ApiClient

    // MARK: Reads (UI source of truth)

    /// Live query of the tasks in a list, ordered for display.
    func observe(listId: String) -> AsyncValueObservation<[TaskItem]> {
        ValueObservation
            .tracking { db in
                try TaskItem
                    .filter(Column("listId") == listId)
                    .order(Column("sortOrder"), Column("createdAt"))
                    .fetchAll(db)
            }
            .values(in: db.writer)
    }

    /// Upsert tasks pulled from the server into the local store.
    func upsert(_ tasks: [TaskItem]) async throws {
        try await db.writer.write { db in
            for task in tasks { try task.save(db) }
        }
    }

    // MARK: Writes (write-through)

    func create(listId: String, title: String, priority: TaskPriority = .none) async throws {
        let now = Date()
        let task = TaskItem(
            id: UUID().uuidString.lowercased(),   // client-generated UUID (§11)
            listId: listId,
            createdBy: nil,
            title: title,
            notes: nil,
            status: .todo,
            priority: priority,
            dueAt: nil, remindAt: nil, recurrenceRule: nil,
            geoLat: nil, geoLng: nil, geoRadius: nil, geoTrigger: nil,
            completedAt: nil,
            sortOrder: now.timeIntervalSince1970,   // append to the end
            createdAt: now,
            updatedAt: now
        )
        try await upsert([task])   // optimistic
        let saved = try await api.createTask(
            CreateTaskBody(id: task.id, listId: listId, title: title, priority: priority)
        )
        try await upsert([saved])  // reconcile
    }

    func setDone(_ task: TaskItem, done: Bool) async throws {
        var updated = task
        updated.status = done ? .done : .todo
        updated.completedAt = done ? Date() : nil
        updated.updatedAt = Date()
        try await upsert([updated])
        // The server derives completedAt from the status change.
        let saved = try await api.updateTask(id: task.id, UpdateTaskBody(status: updated.status))
        try await upsert([saved])
    }

    func update(_ task: TaskItem, title: String, priority: TaskPriority) async throws {
        var updated = task
        updated.title = title
        updated.priority = priority
        updated.updatedAt = Date()
        try await upsert([updated])
        let saved = try await api.updateTask(
            id: task.id, UpdateTaskBody(title: title, priority: priority)
        )
        try await upsert([saved])
    }

    func delete(_ task: TaskItem) async throws {
        try await db.writer.write { db in
            _ = try TaskItem.deleteOne(db, key: task.id)
        }
        try await api.deleteTask(id: task.id)
    }
}
