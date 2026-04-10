import SwiftUI

struct AgentChatView: View {
    let messages: [AgentMessage]
    let streamingBuffers: [String: String]
    @State private var userScrolledUp = false

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(messages) { msg in
                        MessageBubbleView(message: msg)
                            .id(msg.id)
                    }

                    // Show streaming buffers
                    ForEach(Array(streamingBuffers.keys.sorted()), id: \.self) { agent in
                        if let text = streamingBuffers[agent], !text.isEmpty {
                            StreamingBubbleView(agent: agent, text: text)
                        }
                    }

                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(8)
            }
            .onChange(of: messages.count) {
                if !userScrolledUp {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("bottom")
                    }
                }
            }
            .onChange(of: streamingBuffers) {
                if !userScrolledUp {
                    proxy.scrollTo("bottom")
                }
            }
        }
        .background(Color(nsColor: .textBackgroundColor).opacity(0.3))
    }
}

struct StreamingBubbleView: View {
    let agent: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(agentIcon(agent) + " " + agent.uppercased())
                .font(.system(.caption2, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(agentColor(agent))

            Text(text + "\u{2588}")
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.primary)
                .textSelection(.enabled)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(alignment: .leading) {
            Rectangle().fill(agentColor(agent)).frame(width: 3)
        }
    }
}
