import SwiftUI

/// Editor for a task's title, priority, and reminder (Phase 3 + 4). Saving calls back
/// into the view model, which pushes the change through the repository and reconciles
/// the on-device reminder.
struct EditTaskView: View {
    @Environment(\.dismiss) private var dismiss

    private let original: TaskItem
    @State private var title: String
    @State private var priority: TaskPriority
    @State private var remindOn: Bool
    @State private var remindAt: Date
    private let onSave: (String, TaskPriority, Date?) async -> Void

    init(task: TaskItem, onSave: @escaping (String, TaskPriority, Date?) async -> Void) {
        self.original = task
        _title = State(initialValue: task.title)
        _priority = State(initialValue: task.priority)
        _remindOn = State(initialValue: task.remindAt != nil)
        // Default a new reminder to one hour out.
        _remindAt = State(initialValue: task.remindAt ?? Date().addingTimeInterval(3600))
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
                Section("Reminder") {
                    Toggle("Remind me", isOn: $remindOn.animation())
                    if remindOn {
                        DatePicker(
                            "At",
                            selection: $remindAt,
                            in: Date()...,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                    }
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
                            await onSave(title, priority, remindOn ? remindAt : nil)
                            dismiss()
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
