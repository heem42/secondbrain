import SwiftUI

/// The task-list *screen*: the tasks inside one list, rendered from the local store.
struct TaskListView: View {
    @State private var model: TaskListViewModel

    init(list: TaskList, repository: TaskRepository) {
        _model = State(initialValue: TaskListViewModel(list: list, repository: repository))
    }

    var body: some View {
        List {
            if model.tasks.isEmpty {
                ContentUnavailableView(
                    "No tasks",
                    systemImage: "checklist",
                    description: Text("Tasks in this list will appear here.")
                )
            } else {
                ForEach(model.tasks) { task in
                    TaskRow(task: task)
                }
            }
        }
        .navigationTitle(model.list.name)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
    }
}

private struct TaskRow: View {
    let task: TaskItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: task.isDone ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(task.isDone ? .green : .secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .strikethrough(task.isDone)
                    .foregroundStyle(task.isDone ? .secondary : .primary)
                if let due = task.dueAt {
                    Text(due, style: .date)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if task.priority == .high {
                Image(systemName: "exclamationmark.2").foregroundStyle(.orange)
            }
        }
    }
}
