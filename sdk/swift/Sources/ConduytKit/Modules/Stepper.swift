import Foundation

/// Typed wrapper for the CONDUYT stepper-driver module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytStepper {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Configure pins. Pass enPin=0xFF if the driver has no enable line.
    public func config(stepPin: UInt8, dirPin: UInt8, enPin: UInt8 = 0xFF, stepsPerRev: UInt16 = 200) async throws {
        var p = Data([moduleID, 0x01, stepPin, dirPin, enPin])
        p.appendLE(uint16: stepsPerRev)
        _ = try await device.modCmd(p)
    }

    /// Move a relative number of steps (negative reverses) at speedHz.
    public func move(steps: Int32, speedHz: UInt16) async throws {
        var p = Data([moduleID, 0x02])
        p.appendLE(int32: steps)
        p.appendLE(uint16: speedHz)
        _ = try await device.modCmd(p)
    }

    /// Move to absolute position at speedHz.
    public func moveTo(position: Int32, speedHz: UInt16) async throws {
        var p = Data([moduleID, 0x03])
        p.appendLE(int32: position)
        p.appendLE(uint16: speedHz)
        _ = try await device.modCmd(p)
    }

    /// Halt the stepper immediately.
    public func stop() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x04]))
    }
}
