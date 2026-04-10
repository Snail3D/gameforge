import SwiftUI

struct MessageBubbleView: View {
    let message: AgentMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(agentIcon(message.agent) + " " + message.agent.uppercased())
                    .font(.system(.caption2, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundStyle(agentColor(message.agent))

                Spacer()

                if message.tokPerSec > 0 {
                    Text(String(format: "%.1f tok/s", message.tokPerSec))
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }

            if message.isToolCall {
                Text(message.content)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.green)
            } else {
                Text(message.content)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
            }

            HStack {
                Text(message.timestamp, style: .time)
                if !message.model.isEmpty {
                    Text("| \(message.model)")
                }
            }
            .font(.system(.caption2, design: .monospaced))
            .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(message.agent == "ghost"
                    ? Color.blue.opacity(0.05)
                    : Color(nsColor: .controlBackgroundColor))
        )
        .overlay(alignment: .leading) {
            Rectangle().fill(agentColor(message.agent)).frame(width: 3)
        }
    }
}

// Agent colors and icons
func agentColor(_ agent: String) -> Color {
    switch agent {
    case "supervisor": return .orange
    case "builder": return .blue
    case "reviewer": return .purple
    case "critic": return .pink
    case "ghost": return .gray
    case "planner": return Color(red: 1, green: 0.53, blue: 0.27)
    case "scout": return .mint
    default: return .secondary
    }
}

func agentIcon(_ agent: String) -> String {
    switch agent {
    case "supervisor": return "\u{2699}\u{FE0F}"
    case "builder": return "\u{1F528}"
    case "reviewer": return "\u{1F50D}"
    case "critic": return "\u{1F3AE}"
    case "ghost": return "\u{1F47B}"
    case "planner": return "\u{1F9E0}"
    case "scout": return "\u{1F441}\u{FE0F}"
    default: return "\u{2022}"
    }
}
