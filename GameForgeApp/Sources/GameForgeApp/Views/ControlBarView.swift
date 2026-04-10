import SwiftUI

struct ControlBarView: View {
    @Bindable var state: AppState

    var body: some View {
        HStack(spacing: 12) {
            // Title
            HStack(spacing: 6) {
                Image(systemName: "hammer.fill")
                    .foregroundStyle(.forgeGreen)
                    .font(.system(.body))
                Text("GAMEFORGE")
                    .font(.system(.title3, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundStyle(.forgeGreen)
            }

            Divider().frame(height: 20).overlay(Color.forgeGreen.opacity(0.3))

            // Prompt
            TextField("Game prompt...", text: $state.prompt)
                .textFieldStyle(.plain)
                .font(.system(.body, design: .monospaced))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.black.opacity(0.3))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.forgeGreen.opacity(0.25), lineWidth: 1)
                )
                .frame(minWidth: 200)

            // Mode
            Picker("", selection: $state.mode) {
                Text("Build").tag("build")
                Text("Dealer").tag("dealers_choice")
                Text("Timed").tag("timed")
                Text("Infinite").tag("infinite")
            }
            .frame(width: 100)

            // Preset badge
            Text(state.preset.uppercased())
                .font(.system(.caption2, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(.black)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule().fill(presetColor(state.preset))
                )

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
                        .font(.system(.body, design: .monospaced))
                        .fontWeight(.semibold)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red.opacity(0.8))
            } else {
                Button(action: { state.start() }) {
                    Label("Start Forging", systemImage: "hammer.fill")
                        .font(.system(.body, design: .monospaced))
                        .fontWeight(.bold)
                }
                .buttonStyle(.borderedProminent)
                .tint(.forgeGreen)
                .foregroundStyle(.black)
                .keyboardShortcut(.return, modifiers: .command)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            LinearGradient(
                colors: [Color.black.opacity(0.4), Color.black.opacity(0.2)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.forgeGreen.opacity(0.15)).frame(height: 1)
        }
    }

    func presetColor(_ preset: String) -> Color {
        switch preset {
        case "dual": return .forgeGreen
        case "single": return .cyan
        case "e4b": return .orange
        case "e2b": return .yellow
        default: return .gray
        }
    }
}
