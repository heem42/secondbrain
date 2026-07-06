import Foundation
import GRDB

/// A named list that groups tasks (ARCHITECTURE.md §1). Named `TaskList`
/// to avoid clashing with SwiftUI's `List`; stored in the `lists` table.
///
/// The struct doubles as the API-decodable shape and the GRDB record — the server
/// returns these exact camelCase keys, and we use camelCase columns on-device so a
/// single `Codable` serves both. Repositories are still the only thing that touch
/// GRDB (§7); models just describe the row.
struct TaskList: Identifiable, Codable, Equatable, FetchableRecord, PersistableRecord {
    var id: String
    var ownerId: String
    var groupId: String?
    var name: String
    var color: String?
    var isInbox: Bool
    var sortOrder: Double
    var createdAt: Date
    var updatedAt: Date

    static let databaseTableName = "lists"
}
