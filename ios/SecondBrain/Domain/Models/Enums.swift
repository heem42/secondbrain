import Foundation
import GRDB

// Mirrors the Postgres enums in ARCHITECTURE.md §5. String-backed so they map
// 1:1 to the API JSON and store as TEXT in the local GRDB store.

enum TaskStatus: String, Codable, CaseIterable, DatabaseValueConvertible {
    case todo
    case inProgress = "in_progress"
    case done
}

enum TaskPriority: String, Codable, CaseIterable, DatabaseValueConvertible {
    case none
    case low
    case medium
    case high
}

enum GeoTrigger: String, Codable, DatabaseValueConvertible {
    case onEnter = "on_enter"
    case onExit = "on_exit"
}

enum MemberRole: String, Codable, DatabaseValueConvertible {
    case owner
    case editor
    case viewer
}
