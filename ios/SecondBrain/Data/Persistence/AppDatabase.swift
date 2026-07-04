import Foundation
import GRDB

/// Owns the on-device SQLite store — the UI's source of truth for reads
/// (ARCHITECTURE.md §2, §8). Schema mirrors the Postgres tables from §5 (minus
/// `password_hash`); columns are camelCase so one `Codable` serves both the API
/// and GRDB. Only repositories talk to this (§7).
final class AppDatabase {
    let writer: DatabaseWriter

    init(_ writer: DatabaseWriter) throws {
        self.writer = writer
        try migrator.migrate(writer)
    }

    /// The store on disk, under Application Support.
    static func makeShared() throws -> AppDatabase {
        let fm = FileManager.default
        let dir = try fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dbURL = dir.appendingPathComponent("secondbrain.sqlite")
        let queue = try DatabaseQueue(path: dbURL.path)
        return try AppDatabase(queue)
    }

    /// An ephemeral store for tests / SwiftUI previews.
    static func makeInMemory() throws -> AppDatabase {
        try AppDatabase(try DatabaseQueue())
    }

    private var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1_lists_and_tasks") { db in
            try db.create(table: "lists") { t in
                t.primaryKey("id", .text)
                t.column("ownerId", .text).notNull()
                t.column("groupId", .text)
                t.column("name", .text).notNull()
                t.column("color", .text)
                t.column("isInbox", .boolean).notNull().defaults(to: false)
                t.column("sortOrder", .double).notNull().defaults(to: 0)
                t.column("createdAt", .datetime).notNull()
                t.column("updatedAt", .datetime).notNull()
            }

            try db.create(table: "tasks") { t in
                t.primaryKey("id", .text)
                t.column("listId", .text).notNull()
                    .references("lists", onDelete: .cascade)
                t.column("createdBy", .text)
                t.column("title", .text).notNull()
                t.column("notes", .text)
                t.column("status", .text).notNull().defaults(to: "todo")
                t.column("priority", .text).notNull().defaults(to: "none")
                t.column("dueAt", .datetime)
                t.column("remindAt", .datetime)
                t.column("recurrenceRule", .text)
                t.column("geoLat", .double)
                t.column("geoLng", .double)
                t.column("geoRadius", .double)
                t.column("geoTrigger", .text)
                t.column("completedAt", .datetime)
                t.column("sortOrder", .double).notNull().defaults(to: 0)
                t.column("createdAt", .datetime).notNull()
                t.column("updatedAt", .datetime).notNull()
            }
            try db.create(index: "tasks_listId_idx", on: "tasks", columns: ["listId"])
        }

        return migrator
    }
}
