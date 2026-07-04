import SwiftUI

/// Switches the whole app between the sign-in screen and the authed experience,
/// driven by AuthService.phase (ARCHITECTURE.md §7).
struct RootView: View {
    let env: AppEnvironment

    var body: some View {
        Group {
            switch env.auth.phase {
            case .loading:
                ProgressView()
            case .signedOut:
                LoginView(auth: env.auth)
            case .signedIn:
                ListsView(env: env)
            }
        }
        .task { env.auth.restore() }
    }
}
