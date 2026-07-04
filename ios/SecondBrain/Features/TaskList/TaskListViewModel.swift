import Foundation
import Observation

/// Streams the tasks of one list from the local store and drives task mutations
/// (ARCHITECTURE.md §7). Intents go straight to the repository, which applies them
/// optimistically to GRDB and pushes to the API; the live query re-renders the UI.
@MainActor
@Observable
final class TaskListViewModel {
    let list: TaskList
    private(set) var tasks: [TaskItem] = []

    var newTaskTitle = ""
    var errorMessage: String?

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

    // MARK: Intents

    func addTask() async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        newTaskTitle = ""
        await run { try await repository.create(listId: list.id, title: title) }
    }

    func toggleDone(_ task: TaskItem) async {
        await run { try await repository.setDone(task, done: !task.isDone) }
    }

    func save(_ task: TaskItem, title: String, priority: TaskPriority, remindAt: Date?) async {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        await run {
            try await repository.update(task, title: trimmed, priority: priority, remindAt: remindAt)
        }
    }

    func delete(_ task: TaskItem) async {
        await run { try await repository.delete(task) }
    }

    private func run(_ operation: () async throws -> Void) async {
        do {
            try await operation()
        } catch {
            errorMessage = (error as? ApiError)?.localizedDescription ?? error.localizedDescription
        }
    }
}
