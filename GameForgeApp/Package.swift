// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GameForgeApp",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "GameForgeApp",
            path: "Sources/GameForgeApp"
        )
    ]
)
