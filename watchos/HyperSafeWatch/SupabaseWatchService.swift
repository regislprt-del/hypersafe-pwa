import Foundation

final class SupabaseWatchService {
    private let baseURL = URL(string: "https://vfdslxlczrrwbyqsotdj.supabase.co")!
    private let apiKey = "sb_publishable_EVAwKv1SEK62Ptol28GJjw_4oROqpDG"
    private let sessionKey = "supabase-session"

    private var session: SessionSnapshot?

    init() {
        if let data = KeychainStore.read(account: sessionKey),
           let saved = try? JSONDecoder().decode(SessionSnapshot.self, from: data) {
            session = saved
        }
    }

    var userID: String? { session?.userID }

    func restoreSession() async throws -> Bool {
        guard session != nil else { return false }
        _ = try await validAccessToken()
        return true
    }

    func signIn(email: String, password: String) async throws {
        let url = baseURL
            .appendingPathComponent("auth")
            .appendingPathComponent("v1")
            .appendingPathComponent("token")
            .appending(queryItems: [URLQueryItem(name: "grant_type", value: "password")])

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(SignInPayload(email: email, password: password))

        let response: AuthResponse = try await send(request, decode: AuthResponse.self)
        guard let userID = response.user?.id,
              let refreshToken = response.refreshToken else {
            throw HyperSafeWatchError.missingUser
        }

        let expiresAt = response.expiresAt.map(Date.init(timeIntervalSince1970:))
            ?? Date().addingTimeInterval(TimeInterval(response.expiresIn))

        let snapshot = SessionSnapshot(
            accessToken: response.accessToken,
            refreshToken: refreshToken,
            userID: userID,
            expiresAt: expiresAt
        )
        try persist(snapshot)
    }

    func signOut() {
        session = nil
        KeychainStore.delete(account: sessionKey)
    }

    func fetchProfile() async throws -> ProfileRow {
        guard let userID = session?.userID else { throw HyperSafeWatchError.noSession }
        let token = try await validAccessToken()

        let url = restURL(
            path: "profiles",
            queryItems: [
                URLQueryItem(name: "id", value: "eq.\(userID)"),
                URLQueryItem(name: "select", value: "id,couple_id")
            ]
        )

        var request = authorizedRequest(url: url, token: token)
        request.httpMethod = "GET"

        let rows: [ProfileRow] = try await send(request, decode: [ProfileRow].self)
        guard let profile = rows.first else { throw HyperSafeWatchError.missingUser }
        return profile
    }

    func fetchTodayEvents(coupleID: String) async throws -> [EventRow] {
        let token = try await validAccessToken()
        let day = Self.localDay()

        let url = restURL(
            path: "events",
            queryItems: [
                URLQueryItem(name: "couple_id", value: "eq.\(coupleID)"),
                URLQueryItem(name: "event_day", value: "eq.\(day)"),
                URLQueryItem(name: "select", value: "id,event_day,kind,slot_no,occurred_at"),
                URLQueryItem(name: "order", value: "occurred_at.asc")
            ]
        )

        var request = authorizedRequest(url: url, token: token)
        request.httpMethod = "GET"
        return try await send(request, decode: [EventRow].self)
    }

    func recordEvent(kind: String, coupleID: String) async throws -> EventRow {
        guard let userID = session?.userID else { throw HyperSafeWatchError.noSession }

        for attempt in 0..<2 {
            let current = try await fetchTodayEvents(coupleID: coupleID)
            let usedSlots = Set(current.filter { $0.kind == kind }.map(\.slotNo))
            guard let slot = (1...3).first(where: { !usedSlots.contains($0) }) else {
                throw HyperSafeWatchError.dailyLimit
            }

            do {
                let event = try await insertEvent(
                    kind: kind,
                    slot: slot,
                    coupleID: coupleID,
                    userID: userID
                )
                try? await notifyPartner(eventID: event.id)
                return event
            } catch let error as HyperSafeWatchError {
                if case .server(let status, _) = error, status == 409, attempt == 0 {
                    continue
                }
                throw error
            }
        }

        throw HyperSafeWatchError.invalidResponse
    }

    private func insertEvent(
        kind: String,
        slot: Int,
        coupleID: String,
        userID: String
    ) async throws -> EventRow {
        let token = try await validAccessToken()
        let now = Date()

        let payload = NewEventPayload(
            coupleID: coupleID,
            eventDay: Self.localDay(now),
            kind: kind,
            slotNo: slot,
            occurredAt: Self.iso8601(now),
            createdBy: userID
        )

        let url = restURL(path: "events")
        var request = authorizedRequest(url: url, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONEncoder().encode(payload)

        let rows: [EventRow] = try await send(request, decode: [EventRow].self)
        guard let event = rows.first else { throw HyperSafeWatchError.invalidResponse }
        return event
    }

    private func notifyPartner(eventID: String) async throws {
        let token = try await validAccessToken()
        let url = baseURL
            .appendingPathComponent("functions")
            .appendingPathComponent("v1")
            .appendingPathComponent("send-partner-push")

        var request = authorizedRequest(url: url, token: token)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(PushPayload(source: "events", id: eventID))

        _ = try await sendData(request)
    }

    private func validAccessToken() async throws -> String {
        guard let current = session else { throw HyperSafeWatchError.noSession }

        if current.expiresAt.timeIntervalSinceNow > 60 {
            return current.accessToken
        }

        return try await refreshSession()
    }

    private func refreshSession() async throws -> String {
        guard let current = session else { throw HyperSafeWatchError.noSession }

        let url = baseURL
            .appendingPathComponent("auth")
            .appendingPathComponent("v1")
            .appendingPathComponent("token")
            .appending(queryItems: [URLQueryItem(name: "grant_type", value: "refresh_token")])

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(RefreshPayload(refreshToken: current.refreshToken))

        let response: AuthResponse = try await send(request, decode: AuthResponse.self)

        let expiresAt = response.expiresAt.map(Date.init(timeIntervalSince1970:))
            ?? Date().addingTimeInterval(TimeInterval(response.expiresIn))

        let updated = SessionSnapshot(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken ?? current.refreshToken,
            userID: response.user?.id ?? current.userID,
            expiresAt: expiresAt
        )

        try persist(updated)
        return updated.accessToken
    }

    private func persist(_ snapshot: SessionSnapshot) throws {
        let data = try JSONEncoder().encode(snapshot)
        try KeychainStore.save(data, account: sessionKey)
        session = snapshot
    }

    private func restURL(path: String, queryItems: [URLQueryItem] = []) -> URL {
        let base = baseURL
            .appendingPathComponent("rest")
            .appendingPathComponent("v1")
            .appendingPathComponent(path)
        return base.appending(queryItems: queryItems)
    }

    private func authorizedRequest(url: URL, token: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest, decode: T.Type) async throws -> T {
        let data = try await sendData(request)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw HyperSafeWatchError.invalidResponse
        }
    }

    private func sendData(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HyperSafeWatchError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let decoded = try? JSONDecoder().decode(APIErrorPayload.self, from: data)
            let raw = String(data: data, encoding: .utf8)
            let message = decoded?.message ?? decoded?.errorDescription ?? raw ?? "Erreur serveur."
            throw HyperSafeWatchError.server(http.statusCode, message)
        }

        return data
    }

    private static func localDay(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func iso8601(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

private extension URL {
    func appending(queryItems: [URLQueryItem]) -> URL {
        guard !queryItems.isEmpty else { return self }
        var components = URLComponents(url: self, resolvingAgainstBaseURL: false)!
        components.queryItems = (components.queryItems ?? []) + queryItems
        return components.url!
    }
}
