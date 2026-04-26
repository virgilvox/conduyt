#![cfg(feature = "std")]

//! Module-wrapper tests. We exercise each module against a `MockTransport`
//! and assert the wire bytes that hit `transport.sent_packets`. This is the
//! mirror of `firmware/test/test_native_modules` — same protocol, opposite
//! side of the wire.

use conduyt::transports::MockTransport;
use conduyt::wire::{wire_encode, wire_decode, make_packet};
use conduyt::constants::*;
use conduyt::device::Device;
use conduyt::modules::{
    servo::Servo,
    neopixel::NeoPixel,
    oled::OLED,
    dht::DHT,
    encoder::Encoder,
    stepper::Stepper,
    pid::PID,
};

/// Build a minimal HELLO_RESP payload (no modules / no datastreams).
fn make_hello_resp_payload() -> Vec<u8> {
    let mut buf = Vec::new();
    let mut name = [0u8; 16];
    name[..4].copy_from_slice(b"Mock");
    buf.extend_from_slice(&name);
    buf.extend_from_slice(&[1, 0, 0]);
    buf.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04]);
    buf.push(0x00);
    buf.push(4);
    for _ in 0..4 { buf.push(0x0F); }
    buf.extend_from_slice(&[1, 0, 1]);
    buf.extend_from_slice(&[0x00, 0x01]);
    buf.push(0); // 0 modules
    buf.push(0); // 0 datastreams
    buf
}

fn make_response(evt_type: u8, seq: u8, payload: &[u8]) -> Vec<u8> {
    wire_encode(&make_packet(evt_type, seq, payload))
}

/// Set up a connected device with N pre-queued ACK responses for upcoming MOD_CMDs.
fn connected_device_with_acks(num_acks: usize) -> Device<MockTransport> {
    let mut mock = MockTransport::new();
    mock.inject(make_response(EVT_HELLO_RESP, 0, &make_hello_resp_payload()));
    for i in 0..num_acks {
        // seqs 1..=num_acks (connect consumed seq 0)
        mock.inject(make_response(EVT_ACK, (i + 1) as u8, &[]));
    }
    let mut device = Device::new(mock);
    device.connect().expect("connect");
    device
}

/// Pull the payload of the Nth MOD_CMD sent (0-indexed). sent_packets[0] is HELLO.
fn nth_mod_cmd_payload(device: &Device<MockTransport>, n: usize) -> Vec<u8> {
    let raw = &device.transport().sent_packets[1 + n];
    let pkt = wire_decode(raw).expect("decode");
    assert_eq!(pkt.pkt_type, CMD_MOD_CMD, "expected MOD_CMD at index {}", 1 + n);
    pkt.payload
}

// -- Servo --------------------------------------------------------------

#[test]
fn servo_attach_wire_format() {
    let mut device = connected_device_with_acks(1);
    Servo::new(&mut device, 0x07).attach(9, 1000, 2000).unwrap();
    let p = nth_mod_cmd_payload(&device, 0);
    assert_eq!(p, vec![0x07, 0x01, 9, 0xE8, 0x03, 0xD0, 0x07]);
}

#[test]
fn servo_write() {
    let mut device = connected_device_with_acks(1);
    Servo::new(&mut device, 0x07).write(90).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x07, 0x02, 90]);
}

#[test]
fn servo_write_microseconds() {
    let mut device = connected_device_with_acks(1);
    Servo::new(&mut device, 0x07).write_microseconds(1500).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x07, 0x03, 0xDC, 0x05]);
}

#[test]
fn servo_detach() {
    let mut device = connected_device_with_acks(1);
    Servo::new(&mut device, 0x07).detach().unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x07, 0x04]);
}

// -- NeoPixel -----------------------------------------------------------

#[test]
fn neopixel_begin() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).begin(6, 64, 0).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x01, 6, 0x40, 0x00, 0]);
}

#[test]
fn neopixel_set_pixel_no_white() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).set_pixel(5, 255, 128, 0, None).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x02, 5, 0, 255, 128, 0]);
}

#[test]
fn neopixel_set_pixel_with_white() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).set_pixel(5, 255, 128, 0, Some(200)).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x02, 5, 0, 255, 128, 0, 200]);
}

#[test]
fn neopixel_set_range() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).set_range(4, 8, 1, 2, 3).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x03, 4, 0, 8, 0, 1, 2, 3]);
}

#[test]
fn neopixel_fill_no_white() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).fill(10, 20, 30, None).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x04, 10, 20, 30]);
}

#[test]
fn neopixel_show() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).show().unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x05]);
}

#[test]
fn neopixel_set_brightness() {
    let mut device = connected_device_with_acks(1);
    NeoPixel::new(&mut device, 0x03).set_brightness(200).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x03, 0x06, 200]);
}

// -- OLED ---------------------------------------------------------------

#[test]
fn oled_begin() {
    let mut device = connected_device_with_acks(1);
    OLED::new(&mut device, 0x05).begin(128, 64, 0x3C).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x05, 0x01, 128, 64, 0x3C]);
}

#[test]
fn oled_text() {
    let mut device = connected_device_with_acks(1);
    OLED::new(&mut device, 0x05).text(0, 8, 1, "Hi").unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x05, 0x03, 0, 8, 1, b'H', b'i']);
}

#[test]
fn oled_draw_rect_filled() {
    let mut device = connected_device_with_acks(1);
    OLED::new(&mut device, 0x05).draw_rect(1, 2, 3, 4, true).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x05, 0x04, 1, 2, 3, 4, 1]);
}

#[test]
fn oled_show() {
    let mut device = connected_device_with_acks(1);
    OLED::new(&mut device, 0x05).show().unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x05, 0x06]);
}

// -- DHT ----------------------------------------------------------------

#[test]
fn dht_begin() {
    let mut device = connected_device_with_acks(1);
    DHT::new(&mut device, 0x09).begin(4, 22).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x09, 0x01, 4, 22]);
}

#[test]
fn dht_read_decodes_floats() {
    let mut mock = MockTransport::new();
    mock.inject(make_response(EVT_HELLO_RESP, 0, &make_hello_resp_payload()));
    let temp_bits = 23.5f32.to_bits();
    let hum_bits  = 45.0f32.to_bits();
    let mut resp_payload = vec![0x09];
    resp_payload.extend_from_slice(&temp_bits.to_le_bytes());
    resp_payload.extend_from_slice(&hum_bits.to_le_bytes());
    mock.inject(make_response(EVT_MOD_RESP, 1, &resp_payload));

    let mut device = Device::new(mock);
    device.connect().unwrap();
    let r = DHT::new(&mut device, 0x09).read().unwrap();
    assert_eq!(r.temperature_c, 23.5);
    assert_eq!(r.humidity_pct, 45.0);
}

// -- Encoder ------------------------------------------------------------

#[test]
fn encoder_attach() {
    let mut device = connected_device_with_acks(1);
    Encoder::new(&mut device, 0x0A).attach(2, 3).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x0A, 0x01, 2, 3]);
}

#[test]
fn encoder_read_decodes_int32() {
    let mut mock = MockTransport::new();
    mock.inject(make_response(EVT_HELLO_RESP, 0, &make_hello_resp_payload()));
    let count: i32 = -12345;
    let mut resp_payload = vec![0x0A];
    resp_payload.extend_from_slice(&count.to_le_bytes());
    mock.inject(make_response(EVT_MOD_RESP, 1, &resp_payload));

    let mut device = Device::new(mock);
    device.connect().unwrap();
    let n = Encoder::new(&mut device, 0x0A).read().unwrap();
    assert_eq!(n, -12345);
}

#[test]
fn encoder_reset() {
    let mut device = connected_device_with_acks(1);
    Encoder::new(&mut device, 0x0A).reset().unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x0A, 0x03]);
}

// -- Stepper ------------------------------------------------------------

#[test]
fn stepper_config() {
    let mut device = connected_device_with_acks(1);
    Stepper::new(&mut device, 0x0C).config(2, 3, 4, 200).unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x0C, 0x01, 2, 3, 4, 0xC8, 0x00]);
}

#[test]
fn stepper_move_negative() {
    let mut device = connected_device_with_acks(1);
    Stepper::new(&mut device, 0x0C).r#move(-100, 1000).unwrap();
    // -100 LE = 0x9C, 0xFF, 0xFF, 0xFF; 1000 LE = 0xE8, 0x03
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x0C, 0x02, 0x9C, 0xFF, 0xFF, 0xFF, 0xE8, 0x03]);
}

#[test]
fn stepper_stop() {
    let mut device = connected_device_with_acks(1);
    Stepper::new(&mut device, 0x0C).stop().unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x0C, 0x04]);
}

// -- PID ----------------------------------------------------------------

#[test]
fn pid_config_encodes_floats() {
    let mut device = connected_device_with_acks(1);
    PID::new(&mut device, 0x0E).config(1.0, 0.5, 0.1).unwrap();
    let p = nth_mod_cmd_payload(&device, 0);
    let mut want = vec![0x0E, 0x01];
    want.extend_from_slice(&1.0f32.to_le_bytes());
    want.extend_from_slice(&0.5f32.to_le_bytes());
    want.extend_from_slice(&0.1f32.to_le_bytes());
    assert_eq!(p, want);
}

#[test]
fn pid_set_target() {
    let mut device = connected_device_with_acks(1);
    PID::new(&mut device, 0x0E).set_target(50.0).unwrap();
    let mut want = vec![0x0E, 0x02];
    want.extend_from_slice(&50.0f32.to_le_bytes());
    assert_eq!(nth_mod_cmd_payload(&device, 0), want);
}

#[test]
fn pid_enable_disable() {
    let mut device = connected_device_with_acks(2);
    let mut pid = PID::new(&mut device, 0x0E);
    pid.enable().unwrap();
    pid.disable().unwrap();
    assert_eq!(nth_mod_cmd_payload(&device, 0), vec![0x0E, 0x05, 1]);
    assert_eq!(nth_mod_cmd_payload(&device, 1), vec![0x0E, 0x05, 0]);
}
