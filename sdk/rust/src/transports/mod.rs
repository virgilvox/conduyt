//! CONDUYT Transport Layer

/// Transport trait for CONDUYT connections.
pub trait Transport {
    /// Transport error type.
    type Error: core::fmt::Debug;

    /// Connect to the device.
    fn connect(&mut self) -> Result<(), Self::Error>;

    /// Close the connection.
    fn close(&mut self) -> Result<(), Self::Error>;

    /// Send a raw wire-encoded packet.
    fn send(&mut self, packet: &[u8]) -> Result<(), Self::Error>;

    /// Receive a raw wire-encoded packet (blocking).
    fn recv(&mut self) -> Result<Vec<u8>, Self::Error>;

    /// Whether the transport is connected.
    fn connected(&self) -> bool;

    /// Whether this transport requires COBS framing.
    fn needs_cobs(&self) -> bool;
}

/// Mock transport for testing.
pub struct MockTransport {
    connected: bool,
    pub sent_packets: Vec<Vec<u8>>,
    recv_queue: Vec<Vec<u8>>,
}

impl MockTransport {
    pub fn new() -> Self {
        Self {
            connected: false,
            sent_packets: Vec::new(),
            recv_queue: Vec::new(),
        }
    }

    /// Inject a packet as if received from device.
    pub fn inject(&mut self, packet: Vec<u8>) {
        self.recv_queue.push(packet);
    }
}

impl Default for MockTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct MockError(pub String);

impl core::fmt::Display for MockError {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        write!(f, "MockError: {}", self.0)
    }
}

impl Transport for MockTransport {
    type Error = MockError;

    fn connect(&mut self) -> Result<(), MockError> {
        self.connected = true;
        Ok(())
    }

    fn close(&mut self) -> Result<(), MockError> {
        self.connected = false;
        Ok(())
    }

    fn send(&mut self, packet: &[u8]) -> Result<(), MockError> {
        self.sent_packets.push(packet.to_vec());
        Ok(())
    }

    fn recv(&mut self) -> Result<Vec<u8>, MockError> {
        if self.recv_queue.is_empty() {
            return Err(MockError("no packets".into()));
        }
        Ok(self.recv_queue.remove(0))
    }

    fn connected(&self) -> bool {
        self.connected
    }

    fn needs_cobs(&self) -> bool {
        false
    }
}
