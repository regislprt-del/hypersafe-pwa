import SwiftUI

@main
struct HyperSafeWatchApp: App {
    @StateObject private var model = HyperSafeWatchModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}
