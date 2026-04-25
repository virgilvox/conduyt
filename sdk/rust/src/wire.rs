//! CONDUYT Wire Format — Packet encode/decode

extern crate alloc;
use alloc::vec::Vec;
use crate::crc8::crc8;

/// Protocol version.
pub const PROTOCOL_VERSION: u8 = 0x02;
/// Magic bytes ("CD").
pub const MAGIC: [u8; 2] = [0x43, 0x44];
/// Header size in bytes.
pub const HEADER_SIZE: usize = 8;

/// Decoded CONDUYT packet.
#[derive(Debug, Clone, PartialEq)]
pub struct Packet {
    pub version: u8,
    pub pkt_type: u8,
    pub seq: u8,
    pub payload: Vec<u8>,
}

/// Wire encoding error.
#[derive(Debug)]
pub enum WireError {
    IncompletePkt,
    InvalidMagic,
    VersionMismatch,
    CrcMismatch { expected: u8, actual: u8 },
}

impl core::fmt::Display for WireError {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        match self {
            Self::IncompletePkt => write!(f, "incomplete packet"),
            Self::InvalidMagic => write!(f, "invalid magic"),
            Self::VersionMismatch => write!(f, "version mismatch"),
            Self::CrcMismatch { expected, actual } => {
                write!(f, "CRC mismatch: expected 0x{expected:02x}, got 0x{actual:02x}")
            }
        }
    }
}

/// Encode a Packet into raw wire bytes.
pub fn wire_encode(pkt: &Packet) -> Vec<u8> {
    let payload_len = pkt.payload.len();
    let total = HEADER_SIZE + payload_len;
    let mut buf = Vec::with_capacity(total);

    buf.push(MAGIC[0]);
    buf.push(MAGIC[1]);
    buf.push(pkt.version);
    buf.push(pkt.pkt_type);
    buf.push(pkt.seq);
    buf.push((payload_len & 0xFF) as u8);
    buf.push(((payload_len >> 8) & 0xFF) as u8);
    buf.extend_from_slice(&pkt.payload);

    let crc_region = &buf[2..7 + payload_len];
    buf.push(crc8(crc_region));

    buf
}

/// Decode raw wire bytes into a Packet.
pub fn wire_decode(data: &[u8]) -> Result<Packet, WireError> {
    if data.len() < HEADER_SIZE {
        return Err(WireError::IncompletePkt);
    }

    if data[0] != MAGIC[0] || data[1] != MAGIC[1] {
        return Err(WireError::InvalidMagic);
    }

    let version = data[2];
    if version != PROTOCOL_VERSION {
        return Err(WireError::VersionMismatch);
    }

    let pkt_type = data[3];
    let seq = data[4];
    let payload_len = u16::from_le_bytes([data[5], data[6]]) as usize;

    let total = HEADER_SIZE + payload_len;
    if data.len() < total {
        return Err(WireError::IncompletePkt);
    }

    let crc_region = &data[2..7 + payload_len];
    let expected = crc8(crc_region);
    let actual = data[7 + payload_len];

    if expected != actual {
        return Err(WireError::CrcMismatch { expected, actual });
    }

    Ok(Packet {
        version,
        pkt_type,
        seq,
        payload: data[7..7 + payload_len].to_vec(),
    })
}

/// Create a Packet ready for encoding.
pub fn make_packet(pkt_type: u8, seq: u8, payload: &[u8]) -> Packet {
    Packet {
        version: PROTOCOL_VERSION,
        pkt_type,
        seq,
        payload: payload.to_vec(),
    }
}

/// Scan a byte buffer for the first complete, valid CONDUYT packet.
/// Returns `(decoded_packet, bytes_consumed)` or `None`.
pub fn wire_find_packet(buf: &[u8]) -> Option<(Packet, usize)> {
    let len = buf.len();
    if len < HEADER_SIZE {
        return None;
    }

    for i in 0..=len - HEADER_SIZE {
        if buf[i] != MAGIC[0] || buf[i + 1] != MAGIC[1] {
            continue;
        }

        if i + 7 > len {
            return None;
        }
        let payload_len = u16::from_le_bytes([buf[i + 5], buf[i + 6]]) as usize;
        let total = HEADER_SIZE + payload_len;

        if i + total > len {
            return None; // incomplete, need more data
        }

        match wire_decode(&buf[i..i + total]) {
            Ok(pkt) => return Some((pkt, i + total)),
            Err(_) => continue,
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    extern crate alloc;
    use alloc::vec;

    #[test]
    fn ping_roundtrip() {
        let pkt = make_packet(0x01, 7, &[]);
        let enc = wire_encode(&pkt);
        assert_eq!(enc.len(), HEADER_SIZE);
        let dec = wire_decode(&enc).unwrap();
        assert_eq!(dec.pkt_type, 0x01);
        assert_eq!(dec.seq, 7);
        assert!(dec.payload.is_empty());
    }

    #[test]
    fn pin_write_roundtrip() {
        let pkt = make_packet(0x11, 255, &[5, 128]);
        let enc = wire_encode(&pkt);
        let dec = wire_decode(&enc).unwrap();
        assert_eq!(dec.payload, &[5, 128]);
        assert_eq!(dec.seq, 255);
    }

    #[test]
    fn reject_incomplete() {
        assert!(wire_decode(&[0x43, 0x44]).is_err());
    }

    #[test]
    fn reject_bad_magic() {
        assert!(wire_decode(&[0, 0, 1, 1, 0, 0, 0, 0]).is_err());
    }

    #[test]
    fn reject_crc_mismatch() {
        let pkt = make_packet(0x01, 0, &[]);
        let mut enc = wire_encode(&pkt);
        enc[7] ^= 0xFF;
        assert!(wire_decode(&enc).is_err());
    }

    #[test]
    fn find_packet_at_start() {
        let pkt = make_packet(0x01, 5, &[]);
        let enc = wire_encode(&pkt);
        let result = wire_find_packet(&enc).unwrap();
        assert_eq!(result.0.pkt_type, 0x01);
        assert_eq!(result.0.seq, 5);
        assert_eq!(result.1, enc.len());
    }

    #[test]
    fn find_packet_with_leading_garbage() {
        let pkt = make_packet(0x01, 3, &[0xAA]);
        let enc = wire_encode(&pkt);
        let mut buf = vec![0xFF, 0xFE, 0xFD];
        buf.extend_from_slice(&enc);
        let result = wire_find_packet(&buf).unwrap();
        assert_eq!(result.0.pkt_type, 0x01);
        assert_eq!(result.0.seq, 3);
        assert_eq!(result.0.payload, &[0xAA]);
        assert_eq!(result.1, 3 + enc.len());
    }

    #[test]
    fn find_packet_incomplete_returns_none() {
        let pkt = make_packet(0x01, 0, &[1, 2, 3]);
        let enc = wire_encode(&pkt);
        // Truncate to simulate incomplete data
        assert!(wire_find_packet(&enc[..enc.len() - 1]).is_none());
    }

    #[test]
    fn find_packet_no_magic_returns_none() {
        assert!(wire_find_packet(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]).is_none());
    }
}
