import Foundation
import Observation

/// Online-first sync (ARCHITECTURE.md §8). For the skeleton this is the pull half:
/// on launch/foreground, GET the user's lists + their tasks and upsert them into the
/// local store. A write outbox and `changes-since` come in a later milestone (§10).
@MainActor
@Observable
final class SyncService {
    enum State: Equatable {
        case idle
        case syncing
        case failed(String)
    }

    private(set) var state: State = .idle

    @ObservationIgnored private let api: ApiClient
    @ObservationIgnored private let lists: TaskListRepository
    @ObservationIgnored private let tasks: TaskRepository
    @ObservationIgnored private let notifications: NotificationService

    init(
        api: ApiClient,
        lists: TaskListRepository,
        tasks: TaskRepository,
        notifications: NotificationService
    ) {
        self.api = api
        self.lists = lists
        self.tasks = tasks
        self.notifications = notifications
    }

    /// Pull everything the user can see into the local store.
    func pull() async {
        state = .syncing
        do {
            let remoteLists = try await api.fetchLists()
            try await lists.upsert(remoteLists)

            // Pull tasks per list. Fine for the skeleton; a `changes-since` endpoint
            // will replace this fan-out later (§8/§10).
            var allTasks: [TaskItem] = []
            for list in remoteLists {
                let remoteTasks = try await api.fetchTasks(listId: list.id)
                try await tasks.upsert(remoteTasks)
                allTasks.append(contentsOf: remoteTasks)
            }

            // Keep the OS reminder schedule derived from what we just pulled (§7).
            await notifications.reconcileAll(allTasks)
            state = .idle
        } catch {
            state = .failed((error as? ApiError)?.localizedDescription ?? error.localizedDescription)
        }
    }
}
