import Foundation

// Request/response shapes for the auth endpoints. Lists and tasks decode straight
// into the `TaskList` / `TaskItem` domain models (their keys match the API).

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct SignupRequest: Encodable {
    let email: String
    let password: String
    let displayName: String?
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct UserDTO: Codable, Equatable {
    let id: String
    let email: String
    let displayName: String?
}

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: UserDTO
}

struct TokenPair: Codable {
    let accessToken: String
    let refreshToken: String
}

// Task mutations. Only the fields the server's CreateTaskDto/UpdateTaskDto accept —
// nil optionals are omitted by Codable, so an update sends only what changed (§11:
// prefer field-level updates). IDs are client-generated so rows can be made offline.

struct CreateTaskBody: Encodable {
    let id: String
    let listId: String
    let title: String
    var notes: String?
    var priority: TaskPriority?
    var dueAt: Date?
}

/// PATCH body. `dueAt`/`remindAt` are double-optional so we can distinguish "leave
/// unchanged" (outer nil → omitted) from "clear it" (`.some(nil)` → JSON null, which
/// the server maps to NULL). Everything else omits when nil (field-level updates).
struct UpdateTaskBody: Encodable {
    var title: String? = nil
    var notes: String? = nil
    var status: TaskStatus? = nil
    var priority: TaskPriority? = nil
    var dueAt: Date?? = nil
    var remindAt: Date?? = nil

    enum CodingKeys: String, CodingKey {
        case title, notes, status, priority, dueAt, remindAt
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(priority, forKey: .priority)
        try encodeNullable(dueAt, forKey: .dueAt, into: &c)
        try encodeNullable(remindAt, forKey: .remindAt, into: &c)
    }

    private func encodeNullable(
        _ value: Date??,
        forKey key: CodingKeys,
        into container: inout KeyedEncodingContainer<CodingKeys>
    ) throws {
        guard let inner = value else { return }   // outer nil → omit
        if let date = inner {
            try container.encode(date, forKey: key)
        } else {
            try container.encodeNil(forKey: key)   // explicit JSON null → clear
        }
    }
}
