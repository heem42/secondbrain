import Foundation
import Observation

@MainActor
@Observable
final class LoginViewModel {
    enum Mode: String, CaseIterable {
        case login = "Sign In"
        case signup = "Sign Up"
    }

    var mode: Mode = .login
    var email = ""
    var password = ""
    var displayName = ""
    var isBusy = false
    var errorMessage: String?

    @ObservationIgnored private let auth: AuthService

    init(auth: AuthService) {
        self.auth = auth
    }

    var canSubmit: Bool {
        !email.isEmpty && password.count >= 8 && !isBusy
    }

    func submit() async {
        guard canSubmit else { return }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            switch mode {
            case .login:
                try await auth.login(email: email, password: password)
            case .signup:
                try await auth.signup(
                    email: email,
                    password: password,
                    displayName: displayName.isEmpty ? nil : displayName
                )
            }
        } catch {
            errorMessage = (error as? ApiError)?.localizedDescription ?? error.localizedDescription
        }
    }
}
