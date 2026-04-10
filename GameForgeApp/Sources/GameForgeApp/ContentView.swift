import SwiftUI

struct ContentView: View {
    @Bindable var state: AppState

    var body: some View {
        VStack(spacing: 0) {
            ControlBarView(state: state)

            Divider()

            HSplitView {
                VStack(spacing: 0) {
                    GamePreviewView(gameDir: state.gameDir, reloadTrigger: state.reloadCount)
                        .frame(minWidth: 300)

                    Divider()

                    // Progress bar
                    VStack(alignment: .leading, spacing: 4) {
                        ProgressView(value: state.progress)
                            .tint(.green)
                        Text("Step \(state.completedSteps)/\(state.totalSteps) — \(Int(state.progress * 100))%")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    .padding(8)

                    // Step list
                    StepListView(steps: state.steps)
                        .frame(maxHeight: 200)
                }
                .frame(minWidth: 350, idealWidth: 450)

                AgentChatView(
                    messages: state.messages,
                    streamingBuffers: state.streamingBuffers
                )
                .frame(minWidth: 400)
            }

            Divider()

            // Status bar
            HStack(spacing: 16) {
                Label("Cycles: \(state.cycles)", systemImage: "arrow.triangle.2.circlepath")
                Label("Uptime: \(state.formattedUptime)", systemImage: "clock")
                Label("Loops: \(state.loopsCaught)", systemImage: "exclamationmark.triangle")
                Label("Skipped: \(state.skippedSteps)", systemImage: "forward.end")
                Spacer()
                if state.isRunning {
                    Circle().fill(.green).frame(width: 8, height: 8)
                    Text("Running").font(.system(.caption, design: .monospaced))
                } else {
                    Circle().fill(.red).frame(width: 8, height: 8)
                    Text("Stopped").font(.system(.caption, design: .monospaced))
                }
            }
            .font(.system(.caption, design: .monospaced))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.bar)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}
