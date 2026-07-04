import SwiftUI

@main
struct SecondBrainApp: App {
    @State private var env: AppEnvironment

    init() {
        _env = State(initialValue: AppEnvironment.live())
    }

    var body: some Scene {
        WindowGroup {
            RootView(env: env)
        }
    }
}
