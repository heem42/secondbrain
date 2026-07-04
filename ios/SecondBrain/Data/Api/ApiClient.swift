import Foundation

/// Supplies the current access token and can refresh it. AuthService conforms;
/// ApiClient holds it weakly to break the ApiClient⇄AuthService cycle. Async so a
/// `@MainActor` AuthService can satisfy it without isolation friction.
protocol TokenProviding: AnyObject, Sendable {
    func currentAccessToken() async -> String?
    func refreshTokens() async throws
}

/// Thin typed wrapper over URLSession that talks to the NestJS API over HTTPS with
/// a JWT (ARCHITECTURE.md §4). Attaches the bearer token, and on a 401 transparently
/// refreshes once and retries.
final class ApiClient {
    private let baseURL: URL
    private let session: URLSession
    weak var tokenProvider: TokenProviding?

    init(baseURL: URL = ApiConfig.baseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: Auth (unauthenticated)

    func login(email: String, password: String) async throws -> AuthResponse {
        try await send(
            "auth/login", method: "POST",
            body: LoginRequest(email: email, password: password),
            authenticated: false
        )
    }

    func signup(email: String, password: String, displayName: String?) async throws -> AuthResponse {
        try await send(
            "auth/signup", method: "POST",
            body: SignupRequest(email: email, password: password, displayName: displayName),
            authenticated: false
        )
    }

    func refresh(refreshToken: String) async throws -> TokenPair {
        try await send(
            "auth/refresh", method: "POST",
            body: RefreshRequest(refreshToken: refreshToken),
            authenticated: false
        )
    }

    // MARK: Data (authenticated)

    func fetchLists() async throws -> [TaskList] {
        try await send("lists", method: "GET", body: Optional<Empty>.none)
    }

    func fetchTasks(listId: String) async throws -> [TaskItem] {
        try await send("tasks?listId=\(listId)", method: "GET", body: Optional<Empty>.none)
    }

    func createTask(_ body: CreateTaskBody) async throws -> TaskItem {
        try await send("tasks", method: "POST", body: body)
    }

    func updateTask(id: String, _ body: UpdateTaskBody) async throws -> TaskItem {
        try await send("tasks/\(id)", method: "PATCH", body: body)
    }

    func deleteTask(id: String) async throws {
        let _: Empty = try await send("tasks/\(id)", method: "DELETE", body: Optional<Empty>.none)
    }

    // MARK: Core

    private struct Empty: Codable {}

    private func send<Body: Encodable, Response: Decodable>(
        _ path: String,
        method: String,
        body: Body?,
        authenticated: Bool = true,
        isRetry: Bool = false
    ) async throws -> Response {
        // Build the URL by string so query components (e.g. "?listId=") aren't escaped.
        guard let url = URL(string: baseURL.absoluteString + "/" + path) else {
            throw ApiError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authenticated, let token = await tokenProvider?.currentAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try Self.encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw ApiError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw ApiError.invalidResponse
        }

        // On 401, refresh once and retry the original request.
        if http.statusCode == 401 {
            if authenticated, !isRetry, let provider = tokenProvider {
                try await provider.refreshTokens()
                return try await send(path, method: method, body: body,
                                      authenticated: authenticated, isRetry: true)
            }
            throw ApiError.unauthorized
        }

        guard (200..<300).contains(http.statusCode) else {
            throw ApiError.server(status: http.statusCode, message: Self.message(from: data))
        }

        if Response.self == Empty.self { return Empty() as! Response }
        do {
            return try Self.decoder.decode(Response.self, from: data)
        } catch {
            throw ApiError.decoding(error)
        }
    }

    private static func message(from data: Data) -> String? {
        struct ErrorBody: Decodable { let message: MessageValue? }
        // NestJS `message` can be a string or an array of strings.
        enum MessageValue: Decodable {
            case one(String), many([String])
            init(from decoder: Decoder) throws {
                let c = try decoder.singleValueContainer()
                if let s = try? c.decode(String.self) { self = .one(s) }
                else { self = .many((try? c.decode([String].self)) ?? []) }
            }
            var text: String {
                switch self {
                case let .one(s): return s
                case let .many(a): return a.joined(separator: "\n")
                }
            }
        }
        return (try? decoder.decode(ErrorBody.self, from: data))?.message?.text
    }

    // MARK: Coders

    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        // The API emits ISO8601 with fractional seconds (e.g. 2026-07-04T02:22:17.414Z);
        // fall back to whole-second ISO8601 if fractions are absent.
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let whole = ISO8601DateFormatter()
        whole.formatOptions = [.withInternetDateTime]
        d.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            if let date = withFractional.date(from: raw) ?? whole.date(from: raw) {
                return date
            }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Bad date: \(raw)")
            )
        }
        return d
    }()
}
