import SwiftUI

struct StepListView: View {
    let steps: [BuildStep]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                ForEach(steps) { step in
                    HStack(spacing: 6) {
                        stepIcon(step.status)
                            .frame(width: 16)
                        Text(step.title)
                            .font(.system(.caption, design: .monospaced))
                            .lineLimit(1)
                        Spacer()
                        if step.attempt > 1 {
                            Text("x\(step.attempt)")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                }
            }
        }
    }

    @ViewBuilder
    func stepIcon(_ status: BuildStep.Status) -> some View {
        switch status {
        case .passed: Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.caption)
        case .failed: Image(systemName: "xmark.circle.fill").foregroundStyle(.red).font(.caption)
        case .skipped: Image(systemName: "forward.circle.fill").foregroundStyle(.orange).font(.caption)
        case .inProgress: ProgressView().controlSize(.mini)
        case .pending: Image(systemName: "circle").foregroundStyle(.secondary).font(.caption)
        }
    }
}
