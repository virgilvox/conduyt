import Foundation

/// COBS (Consistent Overhead Byte Stuffing) encoder/decoder.
public enum COBS {
    /// Encode data so output never contains 0x00.
    public static func encode(_ src: [UInt8]) -> [UInt8] {
        if src.isEmpty { return [0x01] }

        var dst: [UInt8] = [0] // placeholder for first code
        var codeIdx = 0
        var code: UInt8 = 1

        for b in src {
            if b == 0x00 {
                dst[codeIdx] = code
                codeIdx = dst.count
                dst.append(0) // placeholder
                code = 1
            } else {
                dst.append(b)
                code += 1
                if code == 0xFF {
                    dst[codeIdx] = code
                    codeIdx = dst.count
                    dst.append(0)
                    code = 1
                }
            }
        }
        dst[codeIdx] = code
        return dst
    }

    /// Encode from Data.
    public static func encode(_ data: Data) -> Data {
        Data(encode(Array(data)))
    }

    /// Decode COBS-encoded data. Returns nil on error.
    public static func decode(_ src: [UInt8]) -> [UInt8]? {
        if src.isEmpty { return nil }

        var dst: [UInt8] = []
        var idx = 0

        while idx < src.count {
            let code = src[idx]
            idx += 1

            if code == 0x00 { return nil }

            let count = Int(code - 1)
            if idx + count > src.count { return nil }

            dst.append(contentsOf: src[idx..<(idx + count)])
            idx += count

            if code < 0xFF && idx < src.count {
                dst.append(0x00)
            }
        }
        return dst
    }

    /// Decode from Data. Returns nil on error.
    public static func decode(_ data: Data) -> Data? {
        guard let result = decode(Array(data)) else { return nil }
        return Data(result)
    }
}
