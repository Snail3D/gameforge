import Foundation

final class WebSocketClient {
    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    var onEvent: ((GameForgeEvent) -> Void)?
    private var shouldReconnect = true
    private var retryDelay: TimeInterval = 2
    private let maxRetryDelay: TimeInterval = 30

    func connect(port: Int = 9191) {
        shouldReconnect = true
        // Clean up previous session
        task?.cancel(with: .goingAway, reason: nil)
        session?.invalidateAndCancel()

        let url = URL(string: "ws://localhost:\(port)")!
        session = URLSession(configuration: .default)
        task = session?.webSocketTask(with: url)
        task?.resume()
        receiveLoop()
    }

    func disconnect() {
        shouldReconnect = false
        task?.cancel(with: .goingAway, reason: nil)
        session?.invalidateAndCancel()
        task = nil
        session = nil
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            switch result {
            case .success(.string(let text)):
                self?.retryDelay = 2
                if let data = text.data(using: .utf8),
                   let event = try? JSONDecoder().decode(GameForgeEvent.self, from: data) {
                    self?.onEvent?(event)
                }
                self?.receiveLoop()
            case .success(.data(let data)):
                self?.retryDelay = 2
                if let event = try? JSONDecoder().decode(GameForgeEvent.self, from: data) {
                    self?.onEvent?(event)
                }
                self?.receiveLoop()
            case .failure:
                guard self?.shouldReconnect == true else { return }
                let delay = self?.retryDelay ?? 2
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    self?.retryDelay = min((self?.retryDelay ?? 2) * 2, self?.maxRetryDelay ?? 30)
                    self?.connect()
                }
            @unknown default:
                self?.receiveLoop()
            }
        }
    }
}
