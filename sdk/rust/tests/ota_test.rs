#![cfg(all(feature = "std", feature = "ota"))]

use conduyt::transports::MockTransport;
use conduyt::wire::{wire_encode, wire_decode, make_packet};
use conduyt::constants::*;
use conduyt::device::Device;
use conduyt::ota::{flash, FlashOptions};
use sha2::{Digest, Sha256};

fn make_hello_payload() -> Vec<u8> {
    let mut buf = Vec::new();
    let mut name = [0u8; 16];
    name[..7].copy_from_slice(b"OTAMock");
    buf.extend_from_slice(&name);
    buf.extend_from_slice(&[1, 0, 0]);
    buf.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04]);
    buf.push(0x01);                  // ota_capable
    buf.push(4);                     // pin_count
    for _ in 0..4 { buf.push(0x0F); }
    buf.extend_from_slice(&[1, 0, 1]);
    buf.extend_from_slice(&[0x80, 0x00]);
    buf.push(0); // 0 modules
    buf.push(0); // 0 datastreams
    buf
}

fn make_resp(evt: u8, seq: u8, payload: &[u8]) -> Vec<u8> {
    wire_encode(&make_packet(evt, seq, payload))
}

/// Set up a connected device with N pre-queued ACK responses.
fn connected_with_acks(num_acks: usize) -> Device<MockTransport> {
    let mut mock = MockTransport::new();
    mock.inject(make_resp(EVT_HELLO_RESP, 0, &make_hello_payload()));
    for i in 0..num_acks {
        mock.inject(make_resp(EVT_ACK, (i + 1) as u8, &[]));
    }
    let mut device = Device::new(mock);
    device.connect().expect("connect");
    device
}

/// Pull the payload of the Nth OTA command of `cmd_type` (0-indexed).
fn nth_cmd_payload(device: &Device<MockTransport>, cmd_type: u8, n: usize) -> Vec<u8> {
    let mut seen = 0;
    for raw in &device.transport().sent_packets {
        let pkt = wire_decode(raw).expect("decode");
        if pkt.pkt_type == cmd_type {
            if seen == n { return pkt.payload; }
            seen += 1;
        }
    }
    panic!("no {:#x} command at index {}", cmd_type, n);
}

#[test]
fn ota_rejects_empty_firmware() {
    let mut device = connected_with_acks(0);
    let r = flash(&mut device, &[], FlashOptions::default());
    assert!(r.is_err());
}

#[test]
fn ota_begin_carries_total_and_sha256() {
    let mut device = connected_with_acks(3); // BEGIN + 1 chunk + FINALIZE
    let fw: Vec<u8> = (0..50u8).collect();
    flash(&mut device, &fw, FlashOptions { chunk_size: Some(64), ..Default::default() }).unwrap();

    let begin = nth_cmd_payload(&device, CMD_OTA_BEGIN, 0);
    assert_eq!(begin.len(), 36);
    let total = u32::from_le_bytes([begin[0], begin[1], begin[2], begin[3]]);
    assert_eq!(total, 50);

    let mut h = Sha256::new();
    h.update(&fw);
    let want: [u8; 32] = h.finalize().into();
    assert_eq!(&begin[4..36], &want[..]);
}

#[test]
fn ota_chunks_have_le_u32_offset() {
    // 300 / 100 = 3 chunks + BEGIN + FINALIZE = 5 ACKs
    let mut device = connected_with_acks(5);
    let fw = vec![0u8; 300];
    flash(&mut device, &fw, FlashOptions { chunk_size: Some(100), ..Default::default() }).unwrap();

    for (i, &expected_off) in [0u32, 100, 200].iter().enumerate() {
        let c = nth_cmd_payload(&device, CMD_OTA_CHUNK, i);
        let off = u32::from_le_bytes([c[0], c[1], c[2], c[3]]);
        assert_eq!(off, expected_off, "chunk {}", i);
        assert_eq!(c.len(), 4 + 100);
    }
}

#[test]
fn ota_handles_partial_final_chunk() {
    let mut device = connected_with_acks(4); // BEGIN + 2 chunks + FINALIZE
    let fw = vec![0xAB; 150];
    flash(&mut device, &fw, FlashOptions { chunk_size: Some(100), ..Default::default() }).unwrap();
    assert_eq!(nth_cmd_payload(&device, CMD_OTA_CHUNK, 0).len(), 4 + 100);
    assert_eq!(nth_cmd_payload(&device, CMD_OTA_CHUNK, 1).len(), 4 + 50);
}

#[test]
fn ota_finalize_payload_is_empty() {
    let mut device = connected_with_acks(3);
    flash(&mut device, &vec![0u8; 16], FlashOptions { chunk_size: Some(16), ..Default::default() }).unwrap();
    let final_payload = nth_cmd_payload(&device, CMD_OTA_FINALIZE, 0);
    assert_eq!(final_payload.len(), 0);
}

#[test]
fn ota_progress_callback() {
    let mut device = connected_with_acks(5);
    let mut calls: Vec<(usize, usize)> = Vec::new();
    {
        let mut cb = |sent: usize, total: usize| {
            calls.push((sent, total));
        };
        flash(&mut device, &vec![0u8; 250], FlashOptions {
            chunk_size: Some(100),
            on_progress: Some(&mut cb),
            ..Default::default()
        }).unwrap();
    }
    assert_eq!(calls, vec![(100, 250), (200, 250), (250, 250)]);
}

#[test]
fn ota_rejects_wrong_sha_length() {
    let mut device = connected_with_acks(0);
    let bad = [0u8; 16];
    let r = flash(&mut device, &[1, 2, 3], FlashOptions {
        chunk_size: Some(16),
        sha256: Some(&bad),
        ..Default::default()
    });
    assert!(r.is_err());
}
