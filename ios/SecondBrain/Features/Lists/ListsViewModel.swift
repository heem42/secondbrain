import Foundation
import Observation

/// Streams the user's lists from the local store (ARCHITECTURE.md §7). Reads never
/// hit the network — the UI binds to GRDB, which SyncService keeps fresh.
@MainActor
@Observable
final class ListsViewModel {
    private(set) var lists: [TaskList] = []

    @ObservationIgnored private let repository: TaskListRepository
    @ObservationIgnored private var task: Task<Void, Never>?

    init(repository: TaskListRepository) {
        self.repository = repository
    }

    func start() {
        guard task == nil else { return }
        task = Task { [repository] in
            do {
                for try await rows in repository.observeAll() {
                    self.lists = rows
                }
            } catch {
                // A failed local observation shouldn't crash the UI; leave last value.
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}
