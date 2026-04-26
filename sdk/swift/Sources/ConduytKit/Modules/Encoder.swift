import Foundation

/// Typed wrapper for the CONDUYT quadrature encoder module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytEncoder {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Claim two pins for A/B inputs.
    public func attach(pinA: UInt8, pinB: UInt8) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x01, pinA, pinB]))
    }

    /// Read the current accumulated tick count. Firmware echoes module id, then a LE int32.
    public func read() async throws -> Int32 {
        let resp = try await device.modCmd(Data([moduleID, 0x02]))
        guard resp.count >= 5 else {
            throw ConduytDeviceError.nak(code: 0xFE, name: "SHORT_RESPONSE")
        }
        return resp.readLE(int32At: 1)
    }

    /// Reset the count to zero.
    public func reset() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x03]))
    }
}
