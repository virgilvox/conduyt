import Foundation

/// Typed wrapper for the CONDUYT PID controller module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytPID {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Configure proportional/integral/derivative gains.
    public func config(kp: Float, ki: Float, kd: Float) async throws {
        var p = Data([moduleID, 0x01])
        p.appendLE(float32: kp)
        p.appendLE(float32: ki)
        p.appendLE(float32: kd)
        _ = try await device.modCmd(p)
    }

    /// Set the controller setpoint.
    public func setTarget(_ value: Float) async throws {
        var p = Data([moduleID, 0x02])
        p.appendLE(float32: value)
        _ = try await device.modCmd(p)
    }

    /// Set the analog input pin.
    public func setInput(pin: UInt8) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x03, pin]))
    }

    /// Set the PWM output pin.
    public func setOutput(pin: UInt8) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x04, pin]))
    }

    /// Activate the controller.
    public func enable() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x05, 1]))
    }

    /// Suspend the controller (gains and target are retained).
    public func disable() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x05, 0]))
    }
}
