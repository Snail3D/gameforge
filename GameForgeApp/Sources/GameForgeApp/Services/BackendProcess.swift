import Foundation

final class BackendProcess {
    private var process: Process?
    private let projectDir: URL
    var onLog: ((String) -> Void)?
    var onTerminated: (() -> Void)?

    init(projectDir: URL) {
        self.projectDir = projectDir
    }

    func start(mode: String, preset: String, prompt: String) throws {
        let proc = Process()

        // Resolve node path from shell
        let nodePath = resolveNodePath()
        let npxPath = nodePath.deletingLastPathComponent().appendingPathComponent("npx").path

        proc.executableURL = URL(fileURLWithPath: npxPath)
        proc.arguments = ["tsx", "src/index.ts", "--mode=\(mode)", "--preset=\(preset)", prompt]
        proc.currentDirectoryURL = projectDir

        // Inherit PATH from shell
        var env = ProcessInfo.processInfo.environment
        if let shellPath = getShellPath() {
            env["PATH"] = shellPath
        }
        proc.environment = env

        let outPipe = Pipe()
        proc.standardOutput = outPipe
        proc.standardError = outPipe

        outPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if let str = String(data: data, encoding: .utf8), !str.isEmpty {
                self?.onLog?(str)
            }
        }

        proc.terminationHandler = { [weak self] _ in
            self?.onTerminated?()
        }

        try proc.run()
        self.process = proc
    }

    func stop() {
        process?.interrupt() // SIGINT for graceful shutdown
    }

    private func resolveNodePath() -> URL {
        // Try common locations
        let paths = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node"
        ]
        for p in paths {
            if FileManager.default.fileExists(atPath: p) {
                return URL(fileURLWithPath: p)
            }
        }
        return URL(fileURLWithPath: "/opt/homebrew/bin/node")
    }

    private func getShellPath() -> String? {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
        proc.arguments = ["-l", "-c", "echo $PATH"]
        let pipe = Pipe()
        proc.standardOutput = pipe
        try? proc.run()
        proc.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
