import SwiftUI

struct AgentChatView: View {
    let messages: [AgentMessage]
    let streamingBuffers: [String: String]
    @State private var userScrolledUp = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("AGENT CHAT")
                    .font(.system(.caption, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundStyle(.forgeGreen)

                Spacer()

                Text("\(messages.count) messages")
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.black.opacity(0.3))
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.forgeGreen.opacity(0.15)).frame(height: 1)
            }

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
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
        }
        .background(Color.black.opacity(0.15))
    }
}

struct StreamingBubbleView: View {
    let agent: String
    let text: String
    @State private var cursorVisible = true

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(agentIcon(agent) + " " + agent.uppercased())
                .font(.system(.caption2, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(agentColor(agent))

            HStack(spacing: 0) {
                Text(text)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
                Text("\u{2588}")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.forgeGreen)
                    .opacity(cursorVisible ? 1 : 0)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(
                    LinearGradient(
                        colors: [
                            agentColor(agent).opacity(0.06),
                            Color(nsColor: .controlBackgroundColor).opacity(0.5)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(agentColor(agent))
                .frame(width: 3)
                .padding(.vertical, 2)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                cursorVisible.toggle()
            }
        }
    }
}
