import SwiftUI

/// Lightweight editor for a task's title and priority (Phase 3). Saving calls back
/// into the view model, which pushes the change through the repository.
struct EditTaskView: View {
    @Environment(\.dismiss) private var dismiss

    private let original: TaskItem
    @State private var title: String
    @State private var priority: TaskPriority
    private let onSave: (String, TaskPriority) async -> Void

    init(task: TaskItem, onSave: @escaping (String, TaskPriority) async -> Void) {
        self.original = task
        _title = State(initialValue: task.title)
        _priority = State(initialValue: task.priority)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("Title", text: $title, axis: .vertical)
                }
                Section("Priority") {
                    Picker("Priority", selection: $priority) {
                        ForEach(TaskPriority.allCases, id: \.self) { p in
                            Text(p.rawValue.capitalized).tag(p)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Edit Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await onSave(title, priority)
                            dismiss()
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
