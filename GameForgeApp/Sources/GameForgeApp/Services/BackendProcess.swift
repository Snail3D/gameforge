import Foundation

final class BackendProcess {
    private var process: Process?
    private var outputPipe: Pipe?
    private let projectDir: URL
    var onLog: ((String) -> Void)?
    var onTerminated: (() -> Void)?

    init(projectDir: URL) {
        self.projectDir = projectDir
    }

    func start(mode: String, preset: String, prompt: String) throws {
        let proc = Process()

        proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        proc.arguments = ["npx", "tsx", "src/index.ts", "--mode=\(mode)", "--preset=\(preset)", prompt]
        proc.currentDirectoryURL = projectDir

        // Hardcode common PATH locations — no shell spawn, no blocking
        var env = ProcessInfo.processInfo.environment
        let extraPaths = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            NSHomeDirectory() + "/.local/bin",
            NSHomeDirectory() + "/.cargo/bin",
        ]
        let existingPath = env["PATH"] ?? ""
        env["PATH"] = (extraPaths + existingPath.split(separator: ":").map(String.init)).joined(separator: ":")
        proc.environment = env

        let pipe = Pipe()
        self.outputPipe = pipe
        proc.standardOutput = pipe
        proc.standardError = pipe

        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
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
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        outputPipe = nil
        process?.interrupt()
        process = nil
    }
}
