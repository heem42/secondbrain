import Foundation
import GRDB

/// The only thing that touches the local store for tasks (ARCHITECTURE.md §7).
struct TaskRepository {
    let db: AppDatabase

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

    func upsert(_ tasks: [TaskItem]) async throws {
        try await db.writer.write { db in
            for task in tasks {
                try task.save(db)
            }
        }
    }
}
