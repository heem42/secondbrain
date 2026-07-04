import Foundation
import GRDB

/// A task — the atomic unit of work (ARCHITECTURE.md §1). Named `TaskItem` to avoid
/// clashing with Swift Concurrency's `Task`; stored in the `tasks` table.
///
/// Like `TaskList`, this is both the API-decodable shape and the GRDB record.
/// Geo/recurrence fields are carried through but not yet surfaced in the skeleton UI.
struct TaskItem: Identifiable, Codable, Equatable, FetchableRecord, PersistableRecord {
    var id: String
    var listId: String
    var createdBy: String?
    var title: String
    var notes: String?
    var status: TaskStatus
    var priority: TaskPriority
    var dueAt: Date?
    var remindAt: Date?
    var recurrenceRule: String?
    var geoLat: Double?
    var geoLng: Double?
    var geoRadius: Double?
    var geoTrigger: GeoTrigger?
    var completedAt: Date?
    var sortOrder: Double
    var createdAt: Date
    var updatedAt: Date

    static let databaseTableName = "tasks"

    var isDone: Bool { status == .done }
}
