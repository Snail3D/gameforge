import Foundation

final class WebSocketClient {
    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    var onEvent: ((GameForgeEvent) -> Void)?
    private var shouldReconnect = true

    func connect(port: Int = 9191) {
        shouldReconnect = true
        let url = URL(string: "ws://localhost:\(port)")!
        session = URLSession(configuration: .default)
        task = session?.webSocketTask(with: url)
        task?.resume()
        receiveLoop()
    }

    func disconnect() {
        shouldReconnect = false
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            switch result {
            case .success(.string(let text)):
                if let data = text.data(using: .utf8),
                   let event = try? JSONDecoder().decode(GameForgeEvent.self, from: data) {
                    self?.onEvent?(event)
                }
                self?.receiveLoop()
            case .success(.data(let data)):
                if let event = try? JSONDecoder().decode(GameForgeEvent.self, from: data) {
                    self?.onEvent?(event)
                }
                self?.receiveLoop()
            case .failure:
                guard self?.shouldReconnect == true else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    self?.connect()
                }
            @unknown default:
                self?.receiveLoop()
            }
        }
    }
}
