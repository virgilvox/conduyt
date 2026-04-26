//! CONDUYT Device — async-free device client

extern crate alloc;
use alloc::vec::Vec;

use crate::constants::*;
use crate::wire::{Packet, wire_encode, wire_decode, make_packet};
use crate::transports::Transport;

/// Error from device operations.
#[derive(Debug)]
pub enum DeviceError<E: core::fmt::Debug> {
    Transport(E),
    Nak { code: u8, name: &'static str, seq: u8 },
    Timeout { seq: u8 },
    WireError(crate::wire::WireError),
    NotConnected,
}

impl<E: core::fmt::Debug> core::fmt::Display for DeviceError<E> {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        match self {
            Self::Transport(e) => write!(f, "transport error: {:?}", e),
            Self::Nak { code, name, seq } => write!(f, "NAK: {} (0x{:02x}, seq={})", name, code, seq),
            Self::Timeout { seq } => write!(f, "timeout: seq={}", seq),
            Self::WireError(e) => write!(f, "wire: {}", e),
            Self::NotConnected => write!(f, "not connected"),
        }
    }
}

/// Synchronous CONDUYT device client.
pub struct Device<T: Transport> {
    transport: T,
    seq: u8,
}

impl<T: Transport> Device<T> {
    /// Create a new device client.
    pub fn new(transport: T) -> Self {
        Self { transport, seq: 0 }
    }

    /// Borrow the underlying transport. Useful for tests that need to inspect
    /// the wire bytes a `MockTransport` captured.
    pub fn transport(&self) -> &T { &self.transport }

    /// Connect and perform HELLO handshake.
    pub fn connect(&mut self) -> Result<Vec<u8>, DeviceError<T::Error>> {
        self.transport.connect().map_err(DeviceError::Transport)?;
        let resp = self.send_command(CMD_HELLO, &[])?;
        Ok(resp.payload)
    }

    /// Send a PING.
    pub fn ping(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.send_command(CMD_PING, &[])?;
        Ok(())
    }

    /// Send a RESET.
    pub fn reset(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.send_command(CMD_RESET, &[])?;
        Ok(())
    }

    /// Close the connection.
    pub fn close(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.transport.close().map_err(DeviceError::Transport)
    }

    /// Set pin mode.
    pub fn pin_mode(&mut self, pin: u8, mode: u8) -> Result<(), DeviceError<T::Error>> {
        self.send_command(CMD_PIN_MODE, &[pin, mode])?;
        Ok(())
    }

    /// Write to a pin.
    pub fn pin_write(&mut self, pin: u8, value: u8) -> Result<(), DeviceError<T::Error>> {
        self.send_command(CMD_PIN_WRITE, &[pin, value])?;
        Ok(())
    }

    /// Read a pin value using the mode stored on the firmware
    /// (set via `pin_mode`). Defaults to digital if no mode was set.
    pub fn pin_read(&mut self, pin: u8) -> Result<u16, DeviceError<T::Error>> {
        let resp = self.send_command(CMD_PIN_READ, &[pin])?;
        if resp.payload.len() >= 3 {
            Ok(u16::from_le_bytes([resp.payload[1], resp.payload[2]]))
        } else {
            Ok(0)
        }
    }

    /// Read analog value (0-1023 for 10-bit ADC).
    /// Sends the ANALOG mode byte so the firmware calls analogRead().
    pub fn analog_read(&mut self, pin: u8) -> Result<u16, DeviceError<T::Error>> {
        let resp = self.send_command(CMD_PIN_READ, &[pin, PIN_MODE_ANALOG])?;
        if resp.payload.len() >= 3 {
            Ok(u16::from_le_bytes([resp.payload[1], resp.payload[2]]))
        } else {
            Ok(0)
        }
    }

    /// Read digital value (0 or 1).
    /// Sends the INPUT mode byte so the firmware calls digitalRead().
    pub fn digital_read(&mut self, pin: u8) -> Result<u16, DeviceError<T::Error>> {
        let resp = self.send_command(CMD_PIN_READ, &[pin, PIN_MODE_INPUT])?;
        if resp.payload.len() >= 3 {
            Ok(u16::from_le_bytes([resp.payload[1], resp.payload[2]]))
        } else {
            Ok(0)
        }
    }

    /// Send a module command.
    pub fn mod_cmd(&mut self, payload: &[u8]) -> Result<Vec<u8>, DeviceError<T::Error>> {
        let resp = self.send_command(CMD_MOD_CMD, payload)?;
        Ok(resp.payload)
    }

    /// Send a command and wait for response.
    fn send_command(&mut self, cmd_type: u8, payload: &[u8]) -> Result<Packet, DeviceError<T::Error>> {
        if !self.transport.connected() {
            return Err(DeviceError::NotConnected);
        }

        let seq = self.seq;
        self.seq = self.seq.wrapping_add(1);

        let pkt = make_packet(cmd_type, seq, payload);
        let encoded = wire_encode(&pkt);

        self.transport.send(&encoded).map_err(DeviceError::Transport)?;

        let raw = self.transport.recv().map_err(DeviceError::Transport)?;
        let resp = wire_decode(&raw).map_err(DeviceError::WireError)?;

        if resp.pkt_type == EVT_NAK {
            let code = if resp.payload.is_empty() { 0 } else { resp.payload[0] };
            return Err(DeviceError::Nak {
                code,
                name: err_name(code),
                seq,
            });
        }

        Ok(resp)
    }
}
