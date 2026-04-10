import Foundation

final class FileWatcher {
    private var source: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32 = -1
    private var debounceWork: DispatchWorkItem?
    var onChange: (() -> Void)?

    func watch(directory: URL) {
        stop()
        fileDescriptor = open(directory.path, O_EVTONLY)
        guard fileDescriptor >= 0 else { return }

        source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fileDescriptor,
            eventMask: [.write, .rename],
            queue: .main
        )
        source?.setEventHandler { [weak self] in
            // Debounce — wait 300ms for all writes to settle
            self?.debounceWork?.cancel()
            let work = DispatchWorkItem { self?.onChange?() }
            self?.debounceWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
        }
        source?.setCancelHandler { [weak self] in
            if let fd = self?.fileDescriptor, fd >= 0 { close(fd) }
            self?.fileDescriptor = -1
        }
        source?.resume()
    }

    func stop() {
        source?.cancel()
        source = nil
        debounceWork?.cancel()
    }
}
