import Foundation

/// Little-endian append helpers for module wire payloads. Kept private to
/// `ConduytKit` so consumers don't pollute their `Data` namespace.
extension Data {
    mutating func appendLE(uint16 v: UInt16) {
        append(UInt8(v & 0xFF))
        append(UInt8((v >> 8) & 0xFF))
    }

    mutating func appendLE(int32 v: Int32) {
        let u = UInt32(bitPattern: v)
        append(UInt8(u & 0xFF))
        append(UInt8((u >> 8) & 0xFF))
        append(UInt8((u >> 16) & 0xFF))
        append(UInt8((u >> 24) & 0xFF))
    }

    mutating func appendLE(uint32 v: UInt32) {
        append(UInt8(v & 0xFF))
        append(UInt8((v >> 8) & 0xFF))
        append(UInt8((v >> 16) & 0xFF))
        append(UInt8((v >> 24) & 0xFF))
    }

    mutating func appendLE(float32 v: Float) {
        appendLE(uint32: v.bitPattern)
    }

    func readLE(uint32At i: Int) -> UInt32 {
        UInt32(self[startIndex + i])
            | (UInt32(self[startIndex + i + 1]) << 8)
            | (UInt32(self[startIndex + i + 2]) << 16)
            | (UInt32(self[startIndex + i + 3]) << 24)
    }

    func readLE(int32At i: Int) -> Int32 {
        Int32(bitPattern: readLE(uint32At: i))
    }

    func readLE(float32At i: Int) -> Float {
        Float(bitPattern: readLE(uint32At: i))
    }
}
