import Foundation

/// Typed wrapper for the CONDUYT Servo module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytServo {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Attach to a pin. minUs/maxUs of 0 fall back to firmware defaults (544/2400).
    public func attach(pin: UInt8, minUs: UInt16 = 0, maxUs: UInt16 = 0) async throws {
        var p = Data([moduleID, 0x01, pin])
        p.appendLE(uint16: minUs)
        p.appendLE(uint16: maxUs)
        _ = try await device.modCmd(p)
    }

    /// Write angle (0–180).
    public func write(angle: UInt8) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x02, angle]))
    }

    /// Write a pulse width in microseconds.
    public func writeMicroseconds(_ us: UInt16) async throws {
        var p = Data([moduleID, 0x03])
        p.appendLE(uint16: us)
        _ = try await device.modCmd(p)
    }

    /// Detach the servo.
    public func detach() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x04]))
    }
}
