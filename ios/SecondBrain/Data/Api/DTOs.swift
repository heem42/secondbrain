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

struct UpdateTaskBody: Encodable {
    var title: String?
    var notes: String?
    var status: TaskStatus?
    var priority: TaskPriority?
    var dueAt: Date?
}
