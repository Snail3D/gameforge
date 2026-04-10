import SwiftUI

struct ControlBarView: View {
    @Bindable var state: AppState

    var body: some View {
        HStack(spacing: 12) {
            // Title
            Text("GAMEFORGE")
                .font(.system(.title3, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(.green)

            Divider().frame(height: 20)

            // Prompt
            TextField("Game prompt...", text: $state.prompt)
                .textFieldStyle(.roundedBorder)
                .font(.system(.body, design: .monospaced))
                .frame(minWidth: 200)

            // Mode
            Picker("", selection: $state.mode) {
                Text("Build").tag("build")
                Text("Dealer").tag("dealers_choice")
                Text("Timed").tag("timed")
                Text("Infinite").tag("infinite")
            }
            .frame(width: 100)

            // Preset
            Picker("", selection: $state.preset) {
                Text("Dual (128GB)").tag("dual")
                Text("Single (32GB)").tag("single")
                Text("E4B (16GB)").tag("e4b")
                Text("E2B (8GB)").tag("e2b")
            }
            .frame(width: 120)

            Spacer()

            // Start/Stop
            if state.isRunning {
                Button(action: { state.stop() }) {
                    Label("Stop", systemImage: "stop.fill")
                }
                .tint(.red)
            } else {
                Button(action: { state.start() }) {
                    Label("Start Forging", systemImage: "hammer.fill")
                }
                .tint(.green)
                .keyboardShortcut(.return, modifiers: .command)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.bar)
    }
}
