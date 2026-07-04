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
