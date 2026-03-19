import Foundation

/// Errors from ConduytDevice operations.
public enum ConduytDeviceError: Error, LocalizedError {
    case notConnected
    case timeout(seq: UInt8)
    case nak(code: UInt8, name: String)
    case disconnected

    public var errorDescription: String? {
        switch self {
        case .notConnected: return "Device not connected"
        case .timeout(let seq): return "Timeout waiting for seq \(seq)"
        case .nak(let code, let name): return "NAK: \(name) (0x\(String(code, radix: 16)))"
        case .disconnected: return "Device disconnected"
        }
    }
}

/// High-level CONDUYT device client using async/await.
@available(iOS 15.0, macOS 12.0, *)
public class ConduytDevice {
    private let transport: ConduytTransport
    private let timeout: TimeInterval
    private var seq: UInt8 = 0
    private var pending: [UInt8: CheckedContinuation<ConduytPacket, Error>] = [:]
    private let lock = NSLock()

    /// Create a device client.
    public init(transport: ConduytTransport, timeout: TimeInterval = 5.0) {
        self.transport = transport
        self.timeout = timeout
    }

    /// Connect and perform HELLO handshake.
    public func connect() async throws -> Data {
        try await transport.connect()

        transport.onReceive { [weak self] data in
            self?.handleReceive(data)
        }

        let resp = try await sendCommand(type: ConduytCmd.hello)
        return resp.payload
    }

    /// Disconnect.
    public func disconnect() async throws {
        lock.lock()
        let conts = pending
        pending.removeAll()
        lock.unlock()
        for (_, cont) in conts {
            cont.resume(throwing: ConduytDeviceError.disconnected)
        }
        try await transport.disconnect()
    }

    /// Ping the device.
    public func ping() async throws {
        _ = try await sendCommand(type: ConduytCmd.ping)
    }

    /// Reset the device.
    public func reset() async throws {
        _ = try await sendCommand(type: ConduytCmd.reset)
    }

    /// Set pin mode.
    public func pinMode(_ pin: UInt8, mode: UInt8) async throws {
        _ = try await sendCommand(type: ConduytCmd.pinMode, payload: Data([pin, mode]))
    }

    /// Write to a pin.
    public func pinWrite(_ pin: UInt8, value: UInt8) async throws {
        _ = try await sendCommand(type: ConduytCmd.pinWrite, payload: Data([pin, value]))
    }

    /// Read a pin value.
    public func pinRead(_ pin: UInt8) async throws -> UInt16 {
        let resp = try await sendCommand(type: ConduytCmd.pinRead, payload: Data([pin]))
        guard resp.payload.count >= 3 else { return 0 }
        return UInt16(resp.payload[1]) | (UInt16(resp.payload[2]) << 8)
    }

    /// Send a module command.
    public func modCmd(_ payload: Data) async throws -> Data {
        let resp = try await sendCommand(type: ConduytCmd.modCmd, payload: payload)
        return resp.payload
    }

    // MARK: - Internal

    private func sendCommand(type: UInt8, payload: Data = Data()) async throws -> ConduytPacket {
        guard transport.connected else {
            throw ConduytDeviceError.notConnected
        }

        let currentSeq: UInt8
        lock.lock()
        currentSeq = seq
        seq = seq &+ 1
        lock.unlock()

        let pkt = ConduytPacket(type: type, seq: currentSeq, payload: payload)
        let encoded = wireEncode(pkt)

        try await transport.send(encoded)

        return try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            pending[currentSeq] = continuation
            lock.unlock()

            Task {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                self.lock.lock()
                let cont = self.pending.removeValue(forKey: currentSeq)
                self.lock.unlock()
                cont?.resume(throwing: ConduytDeviceError.timeout(seq: currentSeq))
            }
        }
    }

    private func handleReceive(_ data: Data) {
        guard let pkt = try? wireDecode(data) else { return }

        lock.lock()
        let cont = pending.removeValue(forKey: pkt.seq)
        lock.unlock()

        guard let cont = cont else { return }

        if pkt.type == ConduytEvt.nak {
            let code = pkt.payload.first ?? 0
            cont.resume(throwing: ConduytDeviceError.nak(code: code, name: ConduytErr.name(code)))
        } else {
            cont.resume(returning: pkt)
        }
    }
}
