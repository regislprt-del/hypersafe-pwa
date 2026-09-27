import Foundation

struct HyperEventType: Identifiable, Hashable {
    let id: String
    let label: String

    static let all: [HyperEventType] = [
        .init(id: "rapid", label: "Rapport rapide"),
        .init(id: "normal", label: "Rapport normal"),
        .init(id: "normal_plus_plus", label: "Rapport normal ++"),
        .init(id: "fell_express", label: "Fellation express"),
        .init(id: "scenario", label: "Soirée scénario"),
        .init(id: "anal", label: "Rapport anal"),
        .init(id: "fell", label: "Fellation"),
        .init(id: "scenario_anal", label: "Soirée scénario avec anal")
    ]
}

struct AuthUser: Decodable {
    let id: String
    let email: String?
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int
    let expiresAt: Double?
    let user: AuthUser?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case user
    }
}

struct SessionSnapshot: Codable {
    let accessToken: String
    let refreshToken: String
    let userID: String
    let expiresAt: Date
}

struct ProfileRow: Decodable {
    let id: String
    let coupleID: String?

    enum CodingKeys: String, CodingKey {
        case id
        case coupleID = "couple_id"
    }
}

struct EventRow: Decodable, Identifiable {
    let id: String
    let eventDay: String
    let kind: String
    let slotNo: Int
    let occurredAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case eventDay = "event_day"
        case kind
        case slotNo = "slot_no"
        case occurredAt = "occurred_at"
    }
}

struct SignInPayload: Encodable {
    let email: String
    let password: String
}

struct RefreshPayload: Encodable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

struct NewEventPayload: Encodable {
    let coupleID: String
    let eventDay: String
    let kind: String
    let slotNo: Int
    let occurredAt: String
    let createdBy: String

    enum CodingKeys: String, CodingKey {
        case coupleID = "couple_id"
        case eventDay = "event_day"
        case kind
        case slotNo = "slot_no"
        case occurredAt = "occurred_at"
        case createdBy = "created_by"
    }
}

struct PushPayload: Encodable {
    let source: String
    let id: String
}

struct APIErrorPayload: Decodable {
    let message: String?
    let errorDescription: String?

    enum CodingKeys: String, CodingKey {
        case message
        case errorDescription = "error_description"
    }
}

enum HyperSafeWatchError: LocalizedError {
    case noSession
    case missingUser
    case noCouple
    case dailyLimit
    case invalidResponse
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .noSession:
            return "Connexion requise."
        case .missingUser:
            return "Compte utilisateur introuvable."
        case .noCouple:
            return "Ce compte n’est pas encore rattaché à un couple."
        case .dailyLimit:
            return "3/3 déjà enregistrés aujourd’hui."
        case .invalidResponse:
            return "Réponse serveur invalide."
        case .server(_, let message):
            return message
        }
    }
}
