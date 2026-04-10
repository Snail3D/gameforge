import SwiftUI

struct MessageBubbleView: View {
    let message: AgentMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(agentIcon(message.agent) + " " + message.agent.uppercased())
                    .font(.system(.caption2, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundStyle(agentColor(message.agent))

                Spacer()

                if message.tokPerSec > 0 {
                    Text(String(format: "%.1f tok/s", message.tokPerSec))
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(.forgeGreen.opacity(0.5))
                }
            }

            if message.isToolCall {
                Text(message.content)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.forgeGreen)
                    .padding(6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.black.opacity(0.4))
                    )
            } else {
                Text(message.content)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(maxHeight: 300)
            }

            // Screenshot thumbnail
            if let base64 = message.screenshotBase64,
               let data = Data(base64Encoded: base64),
               let nsImage = NSImage(data: data) {
                Image(nsImage: nsImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 280, maxHeight: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(agentColor(message.agent).opacity(0.4), lineWidth: 1)
                    )
                    .padding(.top, 2)
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
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(
                    LinearGradient(
                        colors: [
                            agentColor(message.agent).opacity(0.06),
                            Color(nsColor: .controlBackgroundColor).opacity(0.5)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(agentColor(message.agent))
                .frame(width: 3)
                .padding(.vertical, 2)
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
