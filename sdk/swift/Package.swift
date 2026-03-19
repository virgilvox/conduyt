// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ConduytKit",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "ConduytKit", targets: ["ConduytKit"]),
    ],
    targets: [
        .target(name: "ConduytKit", path: "Sources/ConduytKit"),
        .testTarget(name: "ConduytKitTests", dependencies: ["ConduytKit"], path: "Tests"),
    ]
)
