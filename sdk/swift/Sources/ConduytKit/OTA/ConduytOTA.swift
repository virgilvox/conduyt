import Foundation
import CryptoKit

/// Tunables for an OTA flash run.
public struct OTAFlashOptions {
    /// Bytes per OTA_CHUNK packet. `nil` = auto-size (240 bytes).
    public var chunkSize: Int?
    /// Optional pre-computed SHA-256. Must be 32 bytes.
    public var sha256: Data?
    /// Optional progress callback. `(sent, total)` in bytes.
    public var onProgress: ((Int, Int) -> Void)?

    public init(chunkSize: Int? = nil, sha256: Data? = nil, onProgress: ((Int, Int) -> Void)? = nil) {
        self.chunkSize = chunkSize
        self.sha256 = sha256
        self.onProgress = onProgress
    }
}

/// Async helper that flashes a firmware image to a connected device.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytOTA {
    private let device: ConduytDevice

    public init(device: ConduytDevice) {
        self.device = device
    }

    /// Flash a firmware image. Resolves once OTA_FINALIZE acks; the device
    /// typically reboots immediately after — the next round-trip will fail
    /// until the caller reconnects.
    public func flash(_ firmware: Data, options: OTAFlashOptions = OTAFlashOptions()) async throws {
        let total = firmware.count
        guard total > 0 else {
            throw ConduytDeviceError.nak(code: 0xFE, name: "OTA_EMPTY_FIRMWARE")
        }

        let digest: Data
        if let s = options.sha256 {
            guard s.count == 32 else {
                throw ConduytDeviceError.nak(code: 0xFE, name: "OTA_BAD_SHA_LENGTH")
            }
            digest = s
        } else {
            digest = Data(SHA256.hash(data: firmware))
        }

        let chunkSize = options.chunkSize ?? 240

        try await device.otaBegin(totalBytes: UInt32(total), sha256: digest)

        var sent = 0
        while sent < total {
            let end = min(sent + chunkSize, total)
            try await device.otaChunk(offset: UInt32(sent), data: firmware.subdata(in: sent..<end))
            sent = end
            options.onProgress?(sent, total)
        }

        try await device.otaFinalize()
    }
}
