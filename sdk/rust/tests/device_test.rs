#![cfg(feature = "std")]

use conduyt::transports::MockTransport;
use conduyt::wire::{wire_encode, make_packet};
use conduyt::constants::*;
use conduyt::device::Device;

/// Build a minimal HELLO_RESP payload for testing.
/// Firmware: "Mock", version 1.0.0, 4 pins with 0x0F caps, 0 modules, 0 datastreams.
fn make_hello_resp_payload() -> Vec<u8> {
    let mut buf = Vec::new();

    // Firmware name (16 bytes, null-padded)
    let mut name = [0u8; 16];
    name[..4].copy_from_slice(b"Mock");
    buf.extend_from_slice(&name);

    // Version: 1.0.0
    buf.extend_from_slice(&[1, 0, 0]);

    // MCU ID (8 bytes)
    buf.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04]);

    // OTA capable = false
    buf.push(0x00);

    // 4 pins, each with caps = 0x0F
    buf.push(4);
    for _ in 0..4 {
        buf.push(0x0F);
    }

    // I2C=1, SPI=0, UART=1
    buf.extend_from_slice(&[1, 0, 1]);

    // Max payload = 256 (uint16 LE)
    buf.extend_from_slice(&[0x00, 0x01]);

    // 0 modules
    buf.push(0);

    // 0 datastreams
    buf.push(0);

    buf
}

/// Create a wire-encoded response packet ready for injection.
fn make_response(evt_type: u8, seq: u8, payload: &[u8]) -> Vec<u8> {
    wire_encode(&make_packet(evt_type, seq, payload))
}

#[test]
fn test_connect() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();
    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));

    let mut device = Device::new(mock);
    let resp = device.connect().expect("connect should succeed");

    // The connect() returns the raw hello payload
    assert!(!resp.is_empty(), "hello response payload should not be empty");
    // First 4 bytes of firmware name should be "Mock"
    assert_eq!(&resp[0..4], b"Mock");
}

#[test]
fn test_ping() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();

    // Inject HELLO_RESP for connect (seq=0), then PONG for ping (seq=1)
    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));
    mock.inject(make_response(EVT_PONG, 1, &[]));

    let mut device = Device::new(mock);
    device.connect().expect("connect should succeed");
    device.ping().expect("ping should succeed");
}

#[test]
fn test_pin_mode() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();

    // Inject HELLO_RESP for connect (seq=0), then ACK for pin_mode (seq=1)
    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));
    mock.inject(make_response(EVT_ACK, 1, &[]));

    let mut device = Device::new(mock);
    device.connect().expect("connect should succeed");
    device.pin_mode(13, 0x01).expect("pin_mode should succeed");
}

#[test]
fn test_pin_write() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();

    // Inject HELLO_RESP for connect (seq=0), then ACK for pin_write (seq=1)
    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));
    mock.inject(make_response(EVT_ACK, 1, &[]));

    let mut device = Device::new(mock);
    device.connect().expect("connect should succeed");
    device.pin_write(13, 1).expect("pin_write should succeed");
}

#[test]
fn test_pin_read() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();

    // PIN_READ_RESP payload: [pin, value_lo, value_hi] for value=512
    let read_payload = vec![13, 0x00, 0x02]; // 512 = 0x0200 LE

    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));
    mock.inject(make_response(EVT_PIN_READ_RESP, 1, &read_payload));

    let mut device = Device::new(mock);
    device.connect().expect("connect should succeed");
    let val = device.pin_read(13).expect("pin_read should succeed");
    assert_eq!(val, 512, "expected pin read value 512, got {}", val);
}

#[test]
fn test_close() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();

    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));

    let mut device = Device::new(mock);
    device.connect().expect("connect should succeed");
    device.close().expect("close should succeed");
}

#[test]
fn test_not_connected() {
    let mock = MockTransport::new();
    let mut device = Device::new(mock);

    // Don't call connect — transport is not connected
    let result = device.ping();
    assert!(result.is_err(), "ping without connect should fail");
    let err_msg = format!("{}", result.unwrap_err());
    assert!(
        err_msg.contains("not connected"),
        "error should mention 'not connected', got: {}",
        err_msg
    );
}

#[test]
fn test_nak_error() {
    let mut mock = MockTransport::new();
    let hello_payload = make_hello_resp_payload();

    // Inject HELLO_RESP for connect (seq=0), then NAK for ping (seq=1)
    mock.inject(make_response(EVT_HELLO_RESP, 0, &hello_payload));
    mock.inject(make_response(EVT_NAK, 1, &[ERR_UNKNOWN_TYPE]));

    let mut device = Device::new(mock);
    device.connect().expect("connect should succeed");

    let result = device.ping();
    assert!(result.is_err(), "ping should fail with NAK");
    let err_msg = format!("{}", result.unwrap_err());
    assert!(
        err_msg.contains("NAK"),
        "error should mention NAK, got: {}",
        err_msg
    );
}
