import SwiftUI

struct ContentView: View {
    @Bindable var state: AppState

    var body: some View {
        VStack(spacing: 0) {
            ControlBarView(state: state)

            Divider().overlay(Color.forgeGreen.opacity(0.3))

            HSplitView {
                VStack(spacing: 0) {
                    GamePreviewView(gameDir: state.gameDir, reloadTrigger: state.reloadCount)
                        .frame(minWidth: 300)

                    Divider().overlay(Color.forgeGreen.opacity(0.15))

                    // Progress bar
                    VStack(alignment: .leading, spacing: 4) {
                        ProgressView(value: state.progress)
                            .tint(.forgeGreen)
                        Text("Step \(state.completedSteps)/\(state.totalSteps) — \(Int(state.progress * 100))%")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.forgeGreen.opacity(0.7))
                    }
                    .padding(8)
                    .background(Color.black.opacity(0.2))

                    // Step list
                    StepListView(steps: state.steps)
                        .frame(maxHeight: 200)
                }
                .frame(minWidth: 350, idealWidth: 500)

                AgentChatView(
                    messages: state.messages,
                    streamingBuffers: state.streamingBuffers
                )
                .frame(minWidth: 400, idealWidth: 600)
            }

            Divider().overlay(Color.forgeGreen.opacity(0.2))

            // Status bar
            HStack(spacing: 16) {
                Label("Cycles: \(state.cycles)", systemImage: "arrow.triangle.2.circlepath")
                Label("Uptime: \(state.formattedUptime)", systemImage: "clock")
                Label("Loops: \(state.loopsCaught)", systemImage: "exclamationmark.triangle")
                Label("Skipped: \(state.skippedSteps)", systemImage: "forward.end")
                Spacer()
                if state.isRunning {
                    Circle().fill(.forgeGreen).frame(width: 8, height: 8)
                    Text("RUNNING").font(.system(.caption, design: .monospaced)).fontWeight(.bold)
                        .foregroundStyle(.forgeGreen)
                } else {
                    Circle().fill(.red.opacity(0.7)).frame(width: 8, height: 8)
                    Text("STOPPED").font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .font(.system(.caption, design: .monospaced))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.black.opacity(0.3))
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .preferredColorScheme(.dark)
    }
}
