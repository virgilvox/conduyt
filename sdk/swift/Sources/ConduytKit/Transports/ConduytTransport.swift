import Foundation

/// Protocol for CONDUYT transport layers.
public protocol ConduytTransport: AnyObject {
    /// Connect to the device.
    func connect() async throws

    /// Disconnect from the device.
    func disconnect() async throws

    /// Send a raw wire-encoded packet.
    func send(_ packet: Data) async throws

    /// Register a handler for received packets.
    func onReceive(_ handler: @escaping (Data) -> Void)

    /// Whether the transport is currently connected.
    var connected: Bool { get }

    /// Whether this transport requires COBS framing.
    var needsCOBS: Bool { get }
}
