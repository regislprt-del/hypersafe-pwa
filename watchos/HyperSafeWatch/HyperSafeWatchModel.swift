import Foundation
import WatchKit

@MainActor
final class HyperSafeWatchModel: ObservableObject {
    @Published var isBootstrapping = true
    @Published var isAuthenticated = false
    @Published var isWorking = false
    @Published var busyKind: String?
    @Published var todayEvents: [EventRow] = []
    @Published var statusMessage: String?
    @Published var errorMessage: String?

    private let service = SupabaseWatchService()
    private var coupleID: String?
    private var didBootstrap = false

    func bootstrap() async {
        guard !didBootstrap else { return }
        didBootstrap = true
        defer { isBootstrapping = false }

        do {
            guard try await service.restoreSession() else {
                isAuthenticated = false
                return
            }
            try await loadProfileAndEvents()
            isAuthenticated = true
        } catch {
            service.signOut()
            isAuthenticated = false
            errorMessage = error.localizedDescription
        }
    }

    func signIn(email: String, password: String) async {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            errorMessage = "Saisis ton e-mail et ton mot de passe."
            return
        }

        isWorking = true
        errorMessage = nil
        statusMessage = nil
        defer { isWorking = false }

        do {
            try await service.signIn(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            try await loadProfileAndEvents()
            isAuthenticated = true
            statusMessage = "Connecté"
        } catch {
            isAuthenticated = false
            errorMessage = error.localizedDescription
        }
    }

    func refresh() async {
        guard let coupleID else { return }
        do {
            todayEvents = try await service.fetchTodayEvents(coupleID: coupleID)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func record(_ type: HyperEventType) async {
        guard let coupleID else {
            errorMessage = HyperSafeWatchError.noCouple.localizedDescription
            return
        }

        if count(for: type.id) >= 3 {
            errorMessage = HyperSafeWatchError.dailyLimit.localizedDescription
            return
        }

        busyKind = type.id
        errorMessage = nil
        statusMessage = nil
        defer { busyKind = nil }

        do {
            let event = try await service.recordEvent(kind: type.id, coupleID: coupleID)
            if !todayEvents.contains(where: { $0.id == event.id }) {
                todayEvents.append(event)
                todayEvents.sort { $0.occurredAt < $1.occurredAt }
            }
            statusMessage = "✓ \(type.label) enregistré"
            WKInterfaceDevice.current().play(.success)

            try? await Task.sleep(for: .seconds(2))
            if statusMessage == "✓ \(type.label) enregistré" {
                statusMessage = nil
            }
        } catch {
            errorMessage = error.localizedDescription
            WKInterfaceDevice.current().play(.failure)
            await refresh()
        }
    }

    func count(for kind: String) -> Int {
        todayEvents.filter { $0.kind == kind }.count
    }

    func signOut() {
        service.signOut()
        coupleID = nil
        todayEvents = []
        statusMessage = nil
        errorMessage = nil
        isAuthenticated = false
    }

    private func loadProfileAndEvents() async throws {
        let profile = try await service.fetchProfile()
        guard let couple = profile.coupleID else {
            throw HyperSafeWatchError.noCouple
        }
        coupleID = couple
        todayEvents = try await service.fetchTodayEvents(coupleID: couple)
    }
}
