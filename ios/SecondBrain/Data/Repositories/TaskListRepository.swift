import Foundation
import GRDB

/// The only thing that touches the local store for lists (ARCHITECTURE.md §7).
/// Reads come from GRDB (UI source of truth); `upsert` applies rows pulled from the API.
struct TaskListRepository {
    let db: AppDatabase

    /// Live query: emits the current lists and re-emits on every change.
    func observeAll() -> AsyncValueObservation<[TaskList]> {
        ValueObservation
            .tracking { db in
                try TaskList
                    .order(Column("sortOrder"), Column("name"))
                    .fetchAll(db)
            }
            .values(in: db.writer)
    }

    func fetchAll() async throws -> [TaskList] {
        try await db.writer.read { db in
            try TaskList.order(Column("sortOrder")).fetchAll(db)
        }
    }

    /// Upsert lists pulled from the server into the local store.
    func upsert(_ lists: [TaskList]) async throws {
        try await db.writer.write { db in
            for list in lists {
                try list.save(db)
            }
        }
    }
}
