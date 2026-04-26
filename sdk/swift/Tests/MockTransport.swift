import Foundation
@testable import ConduytKit

/// In-memory transport used by the module tests. Captures every wire-encoded
/// packet sent by the device, lets tests inject responses, and handles
/// connect/disconnect bookkeeping.
final class MockTransport: ConduytTransport {
    var connected: Bool = false
    var needsCOBS: Bool { false }

    /// Each entry is a fully wire-encoded packet sent by the device.
    private(set) var sentPackets: [Data] = []

    /// Auto-responder: when a sent packet of `cmdType` is observed, respond
    /// using the closure (which can choose ACK / MOD_RESP / NAK and an
    /// arbitrary payload).
    var handlers: [UInt8: (UInt8) -> (type: UInt8, payload: Data)] = [:]

    private var receiveHandler: ((Data) -> Void)?
    private let queue = DispatchQueue(label: "MockTransport")

    func connect() async throws { connected = true }
    func disconnect() async throws { connected = false }

    func send(_ packet: Data) async throws {
        sentPackets.append(packet)
        // Decode the outgoing command to find its type + seq, run the handler,
        // and feed the response back.
        guard let pkt = try? wireDecode(packet) else { return }
        guard let handler = handlers[pkt.type] else { return }
        let resp = handler(pkt.seq)
        let respPkt = ConduytPacket(type: resp.type, seq: pkt.seq, payload: resp.payload)
        let encoded = wireEncode(respPkt)
        // Dispatch async so the device's withCheckedThrowingContinuation has
        // a chance to install before we resume it.
        queue.asyncAfter(deadline: .now() + .milliseconds(1)) { [weak self] in
            self?.receiveHandler?(encoded)
        }
    }

    func onReceive(_ handler: @escaping (Data) -> Void) {
        receiveHandler = handler
    }

    /// Convenience: install ACK handler for MOD_CMD.
    func ackModCmd() {
        handlers[ConduytCmd.modCmd] = { _ in (type: ConduytEvt.ack, payload: Data()) }
    }

    /// Convenience: install MOD_RESP handler for MOD_CMD with a fixed payload.
    func modRespModCmd(_ payload: Data) {
        handlers[ConduytCmd.modCmd] = { _ in (type: ConduytEvt.modResp, payload: payload) }
    }

    /// Convenience: install HELLO handler with the given hello payload.
    func helloResp(_ payload: Data) {
        handlers[ConduytCmd.hello] = { _ in (type: ConduytEvt.helloResp, payload: payload) }
    }

    /// Return the payload of the Nth MOD_CMD sent (0-indexed).
    func nthModCmdPayload(_ n: Int) throws -> Data {
        var seen = 0
        for raw in sentPackets {
            let pkt = try wireDecode(raw)
            if pkt.type == ConduytCmd.modCmd {
                if seen == n { return pkt.payload }
                seen += 1
            }
        }
        throw ConduytDeviceError.timeout(seq: 0)
    }
}
