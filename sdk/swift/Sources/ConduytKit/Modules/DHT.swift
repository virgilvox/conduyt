import Foundation

/// One DHT temperature/humidity sample.
public struct DHTReading: Equatable {
    public let temperatureC: Float
    public let humidityPct: Float
}

/// Typed wrapper for the CONDUYT DHT11/DHT22 module.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytDHT {
    private let device: ConduytDevice
    private let moduleID: UInt8

    public init(device: ConduytDevice, moduleID: UInt8) {
        self.device = device
        self.moduleID = moduleID
    }

    /// Initialize the sensor. kind=11 for DHT11, 22 for DHT22.
    public func begin(pin: UInt8, kind: UInt8 = 22) async throws {
        _ = try await device.modCmd(Data([moduleID, 0x01, pin, kind]))
    }

    /// Trigger a sample. Firmware echoes module id, then two LE float32s.
    public func read() async throws -> DHTReading {
        let resp = try await device.modCmd(Data([moduleID, 0x02]))
        guard resp.count >= 9 else {
            throw ConduytDeviceError.nak(code: 0xFE, name: "SHORT_RESPONSE")
        }
        let temp = resp.readLE(float32At: 1)
        let hum  = resp.readLE(float32At: 5)
        return DHTReading(temperatureC: temp, humidityPct: hum)
    }
}
