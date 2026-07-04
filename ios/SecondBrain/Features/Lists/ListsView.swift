import SwiftUI

/// Home screen after sign-in: the user's lists (from the local store), with a
/// pull-to-sync and sign-out. Tapping a list opens its tasks.
struct ListsView: View {
    let env: AppEnvironment
    @State private var model: ListsViewModel

    init(env: AppEnvironment) {
        self.env = env
        _model = State(initialValue: ListsViewModel(repository: env.listRepository))
    }

    var body: some View {
        NavigationStack {
            List {
                if model.lists.isEmpty {
                    ContentUnavailableView(
                        "No lists yet",
                        systemImage: "tray",
                        description: Text("Pull to sync from the server.")
                    )
                } else {
                    ForEach(model.lists) { list in
                        NavigationLink(value: list) {
                            Label {
                                Text(list.name)
                            } icon: {
                                Image(systemName: list.isInbox ? "tray" : "list.bullet")
                            }
                        }
                    }
                }
            }
            .navigationTitle("Lists")
            .navigationDestination(for: TaskList.self) { list in
                TaskListView(list: list, repository: env.taskRepository)
            }
            .refreshable { await env.sync.pull() }
            .overlay(alignment: .bottom) { syncBanner }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign Out", role: .destructive) { env.auth.signOut() }
                }
            }
            .onAppear { model.start() }
            .task {
                await env.notifications.requestAuthorization()
                await env.sync.pull()
            }
        }
    }

    @ViewBuilder
    private var syncBanner: some View {
        switch env.sync.state {
        case .syncing:
            Label("Syncing…", systemImage: "arrow.triangle.2.circlepath")
                .font(.caption).padding(8)
                .background(.thinMaterial, in: Capsule()).padding(.bottom, 8)
        case let .failed(message):
            Label(message, systemImage: "exclamationmark.triangle")
                .font(.caption).foregroundStyle(.red).padding(8)
                .background(.thinMaterial, in: Capsule()).padding(.bottom, 8)
        case .idle:
            EmptyView()
        }
    }
}

// NavigationLink(value:) needs Hashable; TaskList is Equatable+Codable, add Hashable.
extension TaskList: Hashable {
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
