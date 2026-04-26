import XCTest
import CryptoKit
@testable import ConduytKit

@available(iOS 15.0, macOS 12.0, *)
final class OTATests: XCTestCase {

    /// Minimal HELLO_RESP fixture — ota_capable=1, max_payload=128, no modules.
    private func makeHelloPayload() -> Data {
        var buf = Data()
        var name = Data(count: 16)
        let bytes = Array("OTAMock".utf8)
        for i in 0..<bytes.count { name[i] = bytes[i] }
        buf.append(name)
        buf.append(contentsOf: [1, 0, 0])
        buf.append(contentsOf: [0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04])
        buf.append(0x01)              // ota_capable
        buf.append(4)                  // pin_count
        for _ in 0..<4 { buf.append(0x0F) }
        buf.append(contentsOf: [1, 0, 1])
        buf.append(contentsOf: [0x80, 0x00])
        buf.append(0)                  // 0 modules
        buf.append(0)                  // 0 datastreams
        return buf
    }

    private func connectedDevice() async throws -> (ConduytDevice, MockTransport) {
        let mock = MockTransport()
        mock.helloResp(makeHelloPayload())
        // Auto-ACK every OTA command
        mock.handlers[ConduytCmd.otaBegin]    = { _ in (type: ConduytEvt.ack, payload: Data()) }
        mock.handlers[ConduytCmd.otaChunk]    = { _ in (type: ConduytEvt.ack, payload: Data()) }
        mock.handlers[ConduytCmd.otaFinalize] = { _ in (type: ConduytEvt.ack, payload: Data()) }
        let device = ConduytDevice(transport: mock, timeout: 1.0)
        _ = try await device.connect()
        return (device, mock)
    }

    /// Pull the payload of the Nth OTA command of the given type sent.
    private func nthPayload(_ mock: MockTransport, _ cmd: UInt8, _ n: Int) throws -> Data {
        var seen = 0
        for raw in mock.sentPackets {
            let pkt = try wireDecode(raw)
            if pkt.type == cmd {
                if seen == n { return pkt.payload }
                seen += 1
            }
        }
        XCTFail("no command \(cmd) at index \(n)")
        return Data()
    }

    func testOTARejectsEmpty() async throws {
        let (device, _) = try await connectedDevice()
        do {
            try await ConduytOTA(device: device).flash(Data())
            XCTFail("expected error")
        } catch { /* expected */ }
    }

    func testOTABeginCarriesTotalAndSha256() async throws {
        let (device, mock) = try await connectedDevice()
        var fw = Data()
        for i: UInt8 in 0..<50 { fw.append(i) }
        try await ConduytOTA(device: device).flash(fw, options: OTAFlashOptions(chunkSize: 64))

        let begin = try nthPayload(mock, ConduytCmd.otaBegin, 0)
        XCTAssertEqual(begin.count, 36)
        let total = UInt32(begin[0]) | (UInt32(begin[1]) << 8)
                  | (UInt32(begin[2]) << 16) | (UInt32(begin[3]) << 24)
        XCTAssertEqual(total, 50)

        let want = Data(SHA256.hash(data: fw))
        XCTAssertEqual(begin.subdata(in: 4..<36), want)
    }

    func testOTAChunksHaveLeU32Offset() async throws {
        let (device, mock) = try await connectedDevice()
        let fw = Data(count: 300)
        try await ConduytOTA(device: device).flash(fw, options: OTAFlashOptions(chunkSize: 100))

        for (i, expectedOff) in [UInt32(0), 100, 200].enumerated() {
            let c = try nthPayload(mock, ConduytCmd.otaChunk, i)
            let off = UInt32(c[0]) | (UInt32(c[1]) << 8) | (UInt32(c[2]) << 16) | (UInt32(c[3]) << 24)
            XCTAssertEqual(off, expectedOff, "chunk \(i)")
            XCTAssertEqual(c.count, 4 + 100)
        }
    }

    func testOTAHandlesPartialFinalChunk() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytOTA(device: device).flash(Data(count: 150),
            options: OTAFlashOptions(chunkSize: 100))
        XCTAssertEqual(try nthPayload(mock, ConduytCmd.otaChunk, 0).count, 4 + 100)
        XCTAssertEqual(try nthPayload(mock, ConduytCmd.otaChunk, 1).count, 4 + 50)
    }

    func testOTAFinalizePayloadIsEmpty() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytOTA(device: device).flash(Data(count: 16),
            options: OTAFlashOptions(chunkSize: 16))
        let final = try nthPayload(mock, ConduytCmd.otaFinalize, 0)
        XCTAssertEqual(final.count, 0)
    }

    func testOTAProgressCallback() async throws {
        let (device, _) = try await connectedDevice()
        var calls: [(Int, Int)] = []
        try await ConduytOTA(device: device).flash(Data(count: 250),
            options: OTAFlashOptions(chunkSize: 100,
                                      onProgress: { sent, total in
                                          calls.append((sent, total))
                                      }))
        XCTAssertEqual(calls.count, 3)
        XCTAssertEqual(calls[0].0, 100)
        XCTAssertEqual(calls[1].0, 200)
        XCTAssertEqual(calls[2].0, 250)
    }

    func testOTARejectsWrongShaLength() async throws {
        let (device, _) = try await connectedDevice()
        do {
            try await ConduytOTA(device: device).flash(Data([1, 2, 3]),
                options: OTAFlashOptions(chunkSize: 16, sha256: Data(count: 16)))
            XCTFail("expected error")
        } catch { /* expected */ }
    }
}
