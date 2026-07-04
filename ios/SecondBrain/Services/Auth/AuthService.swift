import Foundation
import Observation

/// Holds the session and mints/refreshes tokens (ARCHITECTURE.md §7). The UI's
/// source of auth truth; conforms to `TokenProviding` so ApiClient can attach and
/// refresh the JWT. Tokens persist in the Keychain across launches.
@MainActor
@Observable
final class AuthService: TokenProviding {
    enum Phase: Equatable {
        case loading
        case signedOut
        case signedIn(UserDTO)
    }

    private(set) var phase: Phase = .loading

    @ObservationIgnored private let api: ApiClient
    @ObservationIgnored private let keychain: KeychainStore
    @ObservationIgnored private var accessToken: String?
    @ObservationIgnored private var refreshToken: String?

    private enum Key {
        static let access = "accessToken"
        static let refresh = "refreshToken"
        static let userId = "userId"
        static let userEmail = "userEmail"
    }

    init(api: ApiClient, keychain: KeychainStore = KeychainStore()) {
        self.api = api
        self.keychain = keychain
    }

    var isSignedIn: Bool {
        if case .signedIn = phase { return true }
        return false
    }

    /// Called at launch: restore a persisted session if one exists.
    func restore() {
        accessToken = keychain.get(Key.access)
        refreshToken = keychain.get(Key.refresh)
        if let token = accessToken, !token.isEmpty,
           let id = keychain.get(Key.userId), let email = keychain.get(Key.userEmail) {
            phase = .signedIn(UserDTO(id: id, email: email, displayName: nil))
        } else {
            phase = .signedOut
        }
    }

    func login(email: String, password: String) async throws {
        let result = try await api.login(email: email, password: password)
        apply(result)
    }

    func signup(email: String, password: String, displayName: String?) async throws {
        let result = try await api.signup(email: email, password: password, displayName: displayName)
        apply(result)
    }

    func signOut() {
        accessToken = nil
        refreshToken = nil
        keychain.delete(Key.access)
        keychain.delete(Key.refresh)
        keychain.delete(Key.userId)
        keychain.delete(Key.userEmail)
        phase = .signedOut
    }

    // MARK: TokenProviding

    func currentAccessToken() async -> String? { accessToken }

    func refreshTokens() async throws {
        guard let refreshToken else {
            signOut()
            throw ApiError.unauthorized
        }
        do {
            let pair = try await api.refresh(refreshToken: refreshToken)
            self.accessToken = pair.accessToken
            self.refreshToken = pair.refreshToken
            keychain.set(pair.accessToken, for: Key.access)
            keychain.set(pair.refreshToken, for: Key.refresh)
        } catch {
            signOut()
            throw error
        }
    }

    // MARK: Private

    private func apply(_ result: AuthResponse) {
        accessToken = result.accessToken
        refreshToken = result.refreshToken
        keychain.set(result.accessToken, for: Key.access)
        keychain.set(result.refreshToken, for: Key.refresh)
        keychain.set(result.user.id, for: Key.userId)
        keychain.set(result.user.email, for: Key.userEmail)
        phase = .signedIn(result.user)
    }
}
