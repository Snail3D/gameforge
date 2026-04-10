import SwiftUI

struct StepListView: View {
    let steps: [BuildStep]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("STEPS")
                    .font(.system(.caption, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundStyle(.forgeGreen)
                Spacer()
                if !steps.isEmpty {
                    Text("\(steps.filter { $0.status == .passed }.count)/\(steps.count)")
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.black.opacity(0.3))
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.forgeGreen.opacity(0.15)).frame(height: 1)
            }

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
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
                                    .foregroundStyle(.orange)
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(index % 2 == 0 ? Color.clear : Color.white.opacity(0.02))
                    }
                }
            }
        }
    }

    @ViewBuilder
    func stepIcon(_ status: BuildStep.Status) -> some View {
        switch status {
        case .passed: Image(systemName: "checkmark.circle.fill").foregroundStyle(.forgeGreen).font(.caption)
        case .failed: Image(systemName: "xmark.circle.fill").foregroundStyle(.red).font(.caption)
        case .skipped: Image(systemName: "forward.circle.fill").foregroundStyle(.orange).font(.caption)
        case .inProgress: ProgressView().controlSize(.mini)
        case .pending: Image(systemName: "circle").foregroundStyle(.secondary).font(.caption)
        }
    }
}
