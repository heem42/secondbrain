import Foundation

/// Composition root / DI container (ARCHITECTURE.md §9: AppEnvironment holds the
/// shared services). Constructed once in `SecondBrainApp` and passed down.
@MainActor
final class AppEnvironment {
    let db: AppDatabase
    let api: ApiClient
    let auth: AuthService
    let listRepository: TaskListRepository
    let taskRepository: TaskRepository
    let sync: SyncService

    init(db: AppDatabase) {
        self.db = db
        let api = ApiClient()
        let auth = AuthService(api: api)
        api.tokenProvider = auth   // wire the JWT provider (weak ref inside ApiClient)

        let listRepository = TaskListRepository(db: db)
        let taskRepository = TaskRepository(db: db, api: api)

        self.api = api
        self.auth = auth
        self.listRepository = listRepository
        self.taskRepository = taskRepository
        self.sync = SyncService(api: api, lists: listRepository, tasks: taskRepository)
    }

    /// Real app store. Falls back to an in-memory store if the disk store can't open,
    /// so the app still launches (it just won't persist).
    static func live() -> AppEnvironment {
        let db = (try? AppDatabase.makeShared()) ?? (try! AppDatabase.makeInMemory())
        return AppEnvironment(db: db)
    }
}
