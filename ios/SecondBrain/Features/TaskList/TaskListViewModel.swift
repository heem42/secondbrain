import Foundation
import Observation

/// Streams the tasks of one list from the local store (ARCHITECTURE.md §7).
@MainActor
@Observable
final class TaskListViewModel {
    let list: TaskList
    private(set) var tasks: [TaskItem] = []

    @ObservationIgnored private let repository: TaskRepository
    @ObservationIgnored private var task: Task<Void, Never>?

    init(list: TaskList, repository: TaskRepository) {
        self.list = list
        self.repository = repository
    }

    func start() {
        guard task == nil else { return }
        task = Task { [repository, listId = list.id] in
            do {
                for try await rows in repository.observe(listId: listId) {
                    self.tasks = rows
                }
            } catch {
                // ignore — keep last rendered value
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}
