import Foundation

/// Typed wrapper for the CONDUYT NeoPixel module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytNeoPixel {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Initialize the strip. typeFlag=0 selects NEO_GRB+800kHz on the firmware side.
    public func begin(pin: UInt8, count: UInt16, typeFlag: UInt8 = 0) async throws {
        var p = Data([moduleID, 0x01, pin])
        p.appendLE(uint16: count)
        p.append(typeFlag)
        _ = try await device.modCmd(p)
    }

    /// Set a single pixel. Pass `w = nil` to omit the white channel.
    public func setPixel(_ index: UInt16, r: UInt8, g: UInt8, b: UInt8, w: UInt8? = nil) async throws {
        var p = Data([moduleID, 0x02])
        p.appendLE(uint16: index)
        p.append(r); p.append(g); p.append(b)
        if let w = w { p.append(w) }
        _ = try await device.modCmd(p)
    }

    /// Set a contiguous range of pixels to one RGB color.
    public func setRange(start: UInt16, count: UInt16, r: UInt8, g: UInt8, b: UInt8) async throws {
        var p = Data([moduleID, 0x03])
        p.appendLE(uint16: start)
        p.appendLE(uint16: count)
        p.append(r); p.append(g); p.append(b)
        _ = try await device.modCmd(p)
    }

    /// Fill all pixels with one color. Pass `w = nil` to omit white.
    public func fill(r: UInt8, g: UInt8, b: UInt8, w: UInt8? = nil) async throws {
        var p = Data([moduleID, 0x04, r, g, b])
        if let w = w { p.append(w) }
        _ = try await device.modCmd(p)
    }

    /// Flush the pixel buffer to the strip.
    public func show() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x05]))
    }

    /// Set global brightness (0–255).
    public func setBrightness(_ brightness: UInt8) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x06, brightness]))
    }
}
