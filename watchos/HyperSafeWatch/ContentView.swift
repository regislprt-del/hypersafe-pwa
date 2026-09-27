import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: HyperSafeWatchModel

    var body: some View {
        Group {
            if model.isBootstrapping {
                ProgressView("Connexion…")
            } else if model.isAuthenticated {
                EventListView()
            } else {
                LoginView()
            }
        }
        .task {
            await model.bootstrap()
        }
    }
}

private struct LoginView: View {
    @EnvironmentObject private var model: HyperSafeWatchModel
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Image(systemName: "heart.text.square")
                    .font(.title2)

                Text("HyperSafe")
                    .font(.headline)

                TextField("E-mail", text: $email)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                SecureField("Mot de passe", text: $password)

                if let error = model.errorMessage {
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await model.signIn(email: email, password: password) }
                } label: {
                    if model.isWorking {
                        ProgressView()
                    } else {
                        Text("Se connecter")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isWorking)
            }
            .padding(.horizontal, 4)
        }
    }
}

private struct EventListView: View {
    @EnvironmentObject private var model: HyperSafeWatchModel

    var body: some View {
        NavigationStack {
            List {
                if let status = model.statusMessage {
                    Section {
                        Text(status)
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }

                if let error = model.errorMessage {
                    Section {
                        Text(error)
                            .font(.caption2)
                            .foregroundStyle(.red)
                    }
                }

                Section("Aujourd’hui") {
                    ForEach(HyperEventType.all) { type in
                        EventButton(type: type)
                    }
                }

                Section {
                    Button("Actualiser") {
                        Task { await model.refresh() }
                    }

                    Button("Se déconnecter", role: .destructive) {
                        model.signOut()
                    }
                }
            }
            .navigationTitle("HyperSafe")
        }
    }
}

private struct EventButton: View {
    @EnvironmentObject private var model: HyperSafeWatchModel
    let type: HyperEventType

    private var count: Int {
        model.count(for: type.id)
    }

    var body: some View {
        Button {
            Task { await model.record(type) }
        } label: {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(type.label)
                        .font(.system(size: 14, weight: .semibold))
                        .multilineTextAlignment(.leading)

                    Text("\(count)/3 aujourd’hui")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 4)

                if model.busyKind == type.id {
                    ProgressView()
                } else {
                    Image(systemName: count >= 3 ? "checkmark.circle.fill" : "plus.circle.fill")
                        .font(.title3)
                }
            }
            .contentShape(Rectangle())
        }
        .disabled(model.busyKind != nil || count >= 3)
    }
}
