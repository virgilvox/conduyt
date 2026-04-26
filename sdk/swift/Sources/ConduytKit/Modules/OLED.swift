import Foundation

/// Typed wrapper for the CONDUYT SSD1306 OLED module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytOLED {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Initialize the display. addr=0 falls back to 0x3C on the firmware.
    public func begin(width: UInt8 = 128, height: UInt8 = 64, addr: UInt8 = 0x3C) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x01, width, height, addr]))
    }

    /// Clear the off-screen buffer. Call `show()` to flush.
    public func clear() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x02]))
    }

    /// Render text into the off-screen buffer.
    public func text(x: UInt8, y: UInt8, size: UInt8, _ s: String) async throws {
        var p = Data([moduleID, 0x03, x, y, size])
        p.append(contentsOf: Array(s.utf8))
        _ = try await device.modCmd(p)
    }

    /// Draw a rectangle. fill=true for a filled rect.
    public func drawRect(x: UInt8, y: UInt8, w: UInt8, h: UInt8, fill: Bool = false) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x04, x, y, w, h, fill ? 1 : 0]))
    }

    /// Draw a 1-bit bitmap. data must hold ceil(w*h/8) bytes.
    public func drawBitmap(x: UInt8, y: UInt8, w: UInt8, h: UInt8, data: Data) async throws {
        var p = Data([moduleID, 0x05, x, y, w, h])
        p.append(data)
        _ = try await device.modCmd(p)
    }

    /// Flush the off-screen buffer to the panel.
    public func show() async throws {
        _ = try await device.modCmd(Data([moduleID, 0x06]))
    }
}
