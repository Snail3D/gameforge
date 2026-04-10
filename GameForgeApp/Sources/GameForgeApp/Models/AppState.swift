import SwiftUI
import Observation

@Observable
final class AppState {
    var messages: [AgentMessage] = []
    var steps: [BuildStep] = []
    var isRunning = false
    var gameDir: URL? = nil
    var reloadCount = 0
    var mode: String = "build"
    var preset: String = "e4b"
    var prompt: String = "Make a chess game with AI opponent"
    var progress: Double = 0
    var cycles: Int = 0
    var loopsCaught: Int = 0
    var completedSteps: Int = 0
    var totalSteps: Int = 0
    var skippedSteps: Int = 0
    var uptimeSeconds: Double = 0
    var streamingBuffers: [String: String] = [:]

    var formattedUptime: String {
        let h = Int(uptimeSeconds) / 3600
        let m = (Int(uptimeSeconds) % 3600) / 60
        let s = Int(uptimeSeconds) % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    // Services
    var backend: BackendProcess?
    var wsClient: WebSocketClient?
    var fileWatcher: FileWatcher?

    func start() {
        guard !isRunning else { return }

        let projectDir = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("gameforge")

        // Clear old games
        let gamesDir = projectDir.appendingPathComponent("games")
        try? FileManager.default.removeItem(at: gamesDir)
        try? FileManager.default.createDirectory(at: gamesDir, withIntermediateDirectories: true)

        // Reset state
        messages = []
        steps = []
        progress = 0
        cycles = 0
        loopsCaught = 0
        completedSteps = 0
        totalSteps = 0
        skippedSteps = 0
        streamingBuffers = [:]
        gameDir = nil

        // Launch backend
        backend = BackendProcess(projectDir: projectDir)
        backend?.onLog = { [weak self] line in
            // Could display raw logs somewhere
            _ = self
            _ = line
        }
        backend?.onTerminated = { [weak self] in
            DispatchQueue.main.async {
                self?.isRunning = false
            }
        }

        do {
            try backend?.start(mode: mode, preset: preset, prompt: prompt)
            isRunning = true

            // Connect WebSocket after a short delay for backend to start
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                self?.connectWebSocket()
            }
        } catch {
            messages.append(AgentMessage(agent: "supervisor", content: "Failed to start: \(error)", model: "", tokPerSec: 0))
        }
    }

    func stop() {
        backend?.stop()
        wsClient?.disconnect()
        fileWatcher?.stop()
        isRunning = false
    }

    private func connectWebSocket() {
        wsClient = WebSocketClient()
        wsClient?.onEvent = { [weak self] event in
            DispatchQueue.main.async {
                // Keep isRunning true as long as we're getting events
                if !(self?.isRunning ?? false) {
                    self?.isRunning = true
                }
                self?.handleEvent(event)
            }
        }
        wsClient?.connect(port: 9191)
    }

    private func handleEvent(_ event: GameForgeEvent) {
        switch event {
        case .message(let m):
            // Finalize any streaming buffer for this agent
            if let buffer = streamingBuffers[m.agent], !buffer.isEmpty {
                streamingBuffers[m.agent] = nil
            }
            messages.append(AgentMessage(agent: m.agent, content: m.content, model: m.model ?? "", tokPerSec: m.tokPerSec ?? 0))

        case .tokenStream(let t):
            streamingBuffers[t.agent, default: ""] += t.token

        case .stepAssign(let s):
            steps.append(BuildStep(id: s.stepId, title: s.title, status: .inProgress))
            totalSteps = max(totalSteps, Int(s.stepId) ?? steps.count)

        case .stepUpdate(let s):
            if let idx = steps.firstIndex(where: { $0.id == s.stepId }) {
                steps[idx].status = BuildStep.Status(rawValue: s.status) ?? .pending
                steps[idx].attempt = s.attempt
            }
            completedSteps = steps.filter { $0.status == .passed }.count
            skippedSteps = steps.filter { $0.status == .skipped }.count
            if totalSteps > 0 {
                progress = Double(completedSteps + skippedSteps) / Double(totalSteps)
            }

        case .systemStats(let s):
            cycles = s.cycles
            loopsCaught = s.loopsCaught
            uptimeSeconds = s.uptimeSeconds
            if s.stepsTotal > 0 {
                totalSteps = s.stepsTotal
                completedSteps = s.stepsCompleted
                progress = Double(s.stepsCompleted) / Double(s.stepsTotal)
            }

        case .gameReady(let g):
            let projectDir = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("gameforge")
            if let urlPath = g.url {
                // Backend sends relative path like "/game/index.html" — derive game dir from it
                let trimmed = urlPath.hasPrefix("/") ? String(urlPath.dropFirst()) : urlPath
                let fullURL = projectDir.appendingPathComponent(trimmed)
                let dir = fullURL.deletingLastPathComponent()
                if FileManager.default.fileExists(atPath: dir.path) {
                    gameDir = dir
                    setupFileWatcher(dir: dir)
                    break
                }
            }
            // Fallback: scan games directory for newest
            let gamesDir = projectDir.appendingPathComponent("games")
            if let dirs = try? FileManager.default.contentsOfDirectory(at: gamesDir, includingPropertiesForKeys: [.creationDateKey])
                .filter({ $0.hasDirectoryPath && !$0.lastPathComponent.starts(with: ".") })
                .sorted(by: {
                    let d1 = try? $0.resourceValues(forKeys: [.creationDateKey]).creationDate
                    let d2 = try? $1.resourceValues(forKeys: [.creationDateKey]).creationDate
                    return (d1 ?? .distantPast) > (d2 ?? .distantPast)
                }),
               let newest = dirs.first {
                gameDir = newest
                setupFileWatcher(dir: newest)
            }

        case .screenshot(let s):
            messages.append(AgentMessage(agent: s.agent, content: "[Screenshot] \(s.description)", model: s.model ?? "", tokPerSec: 0, screenshotBase64: s.base64))

        case .ghostIntervention(let g):
            messages.append(AgentMessage(agent: "ghost", content: "[\(g.trigger)] \(g.response)", model: g.model ?? "", tokPerSec: 0))

        case .loopDetected(let l):
            loopsCaught += 1
            messages.append(AgentMessage(agent: "supervisor", content: "Loop detected (attempt \(l.recoveryAttempt)): \(String(l.repeatedTokens.prefix(80)))", model: "", tokPerSec: 0))

        case .toolCall(let t):
            messages.append(AgentMessage(agent: t.agent, content: "[\(t.tool)] \(t.result)", model: t.model ?? "", tokPerSec: 0, isToolCall: true))
            // Reload game if files were written
            if t.tool == "write_file" {
                reloadCount += 1
            }

        case .gameReload(let r):
            if r.success { reloadCount += 1 }

        case .modelSwap(let m):
            messages.append(AgentMessage(agent: "supervisor", content: "Loading \(m.loading)\(m.unloading.map { ", unloading \($0)" } ?? "")", model: "", tokPerSec: 0))

        case .featureUpdate, .gitPush:
            break // Handle later if needed

        case .unknown:
            break
        }
    }

    private func setupFileWatcher(dir: URL) {
        fileWatcher?.stop()
        fileWatcher = FileWatcher()
        fileWatcher?.onChange = { [weak self] in
            DispatchQueue.main.async {
                self?.reloadCount += 1
            }
        }
        fileWatcher?.watch(directory: dir)
    }
}

struct AgentMessage: Identifiable {
    let id = UUID()
    let agent: String
    let content: String
    let model: String
    let tokPerSec: Double
    let timestamp = Date()
    var screenshotBase64: String? = nil
    var isToolCall: Bool = false
}

struct BuildStep: Identifiable {
    let id: String
    let title: String
    var status: Status = .pending
    var attempt: Int = 0

    enum Status: String {
        case pending, inProgress = "in_progress", passed, failed, skipped
    }
}
