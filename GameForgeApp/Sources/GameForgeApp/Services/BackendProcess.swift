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

        // Use /usr/bin/env to find npx via PATH — works with nvm, fnm, homebrew, etc.
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        proc.arguments = ["npx", "tsx", "src/index.ts", "--mode=\(mode)", "--preset=\(preset)", prompt]
        proc.currentDirectoryURL = projectDir

        // Get PATH from user's shell
        var env = ProcessInfo.processInfo.environment
        if let shellPath = getShellPath() {
            env["PATH"] = shellPath
        }
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

    private func getShellPath() -> String? {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
        proc.arguments = ["-l", "-c", "echo $PATH"]
        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = FileHandle.nullDevice
        try? proc.run()
        proc.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
