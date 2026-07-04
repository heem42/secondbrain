import Foundation
import UserNotifications

/// Schedules on-device local notifications for a task's `remind_at`
/// (ARCHITECTURE.md §2, §5, §7). The OS schedule is *derived from local-store state*:
/// every write and every pull reconciles it, so a notification exists iff the task
/// has a future `remind_at` and isn't done. Because it's scheduled locally from task
/// data, reminders fire even fully offline (§2, decision 5).
@MainActor
final class NotificationService {
    private let center = UNUserNotificationCenter.current()
    private let foregroundDelegate = ForegroundNotificationDelegate()

    init() {
        // Show reminders as a banner even when the app is foregrounded (useful in dev).
        center.delegate = foregroundDelegate
    }

    @discardableResult
    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    /// Bring the OS schedule for one task in line with its current state.
    func reconcile(for task: TaskItem) async {
        cancel(task.id)
        guard shouldSchedule(task) else { return }

        let content = UNMutableNotificationContent()
        content.title = task.title
        content.body = task.notes?.isEmpty == false ? task.notes! : "Reminder"
        content.sound = .default

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: task.remindAt!
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: task.id, content: content, trigger: trigger)
        try? await center.add(request)
    }

    /// Reconcile the whole set after a pull: schedule/cancel each and drop any pending
    /// requests whose task no longer warrants one (self-healing, §7).
    func reconcileAll(_ tasks: [TaskItem]) async {
        let pending = await center.pendingNotificationRequests().map(\.identifier)
        let wanted = Set(tasks.filter(shouldSchedule).map(\.id))
        let orphaned = pending.filter { !wanted.contains($0) }
        if !orphaned.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: orphaned)
        }
        for task in tasks { await reconcile(for: task) }
    }

    func cancel(_ taskId: String) {
        center.removePendingNotificationRequests(withIdentifiers: [taskId])
        center.removeDeliveredNotifications(withIdentifiers: [taskId])
    }

    private func shouldSchedule(_ task: TaskItem) -> Bool {
        guard let remindAt = task.remindAt else { return false }
        return !task.isDone && remindAt > Date()
    }
}

/// Presents reminders while the app is in the foreground.
private final class ForegroundNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}
