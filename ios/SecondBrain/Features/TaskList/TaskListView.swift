import SwiftUI

/// The task-list *screen*: the tasks inside one list, rendered from the local store,
/// with create / complete / edit / delete wired through the repository (Phase 3).
struct TaskListView: View {
    @State private var model: TaskListViewModel
    @State private var editing: TaskItem?

    init(list: TaskList, repository: TaskRepository) {
        _model = State(initialValue: TaskListViewModel(list: list, repository: repository))
    }

    var body: some View {
        List {
            Section {
                HStack {
                    Image(systemName: "plus.circle.fill").foregroundStyle(.tint)
                    TextField("Add a task", text: $model.newTaskTitle)
                        .submitLabel(.done)
                        .onSubmit { Task { await model.addTask() } }
                }
            }

            Section {
                if model.tasks.isEmpty {
                    Text("No tasks yet").foregroundStyle(.secondary)
                } else {
                    ForEach(model.tasks) { task in
                        TaskRow(task: task, onToggle: { Task { await model.toggleDone(task) } })
                            .contentShape(Rectangle())
                            .onTapGesture { editing = task }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await model.delete(task) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
            }
        }
        .navigationTitle(model.list.name)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
        .sheet(item: $editing) { task in
            EditTaskView(task: task) { title, priority, remindAt in
                await model.save(task, title: title, priority: priority, remindAt: remindAt)
            }
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }
}

private struct TaskRow: View {
    let task: TaskItem
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: task.isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(task.isDone ? .green : .secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .strikethrough(task.isDone)
                    .foregroundStyle(task.isDone ? .secondary : .primary)
                if let remind = task.remindAt {
                    Label {
                        Text(remind, format: .dateTime.month().day().hour().minute())
                    } icon: {
                        Image(systemName: "bell.fill")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                } else if let due = task.dueAt {
                    Text(due, style: .date).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if task.priority == .high {
                Image(systemName: "exclamationmark.2").foregroundStyle(.orange)
            }
        }
    }
}
