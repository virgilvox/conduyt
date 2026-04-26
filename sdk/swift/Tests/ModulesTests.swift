import XCTest
@testable import ConduytKit

/// HELLO_RESP fixture: "Mock" firmware, 4 pins, 0 modules, 0 datastreams.
private func helloRespPayload() -> Data {
    var buf = Data()
    var name = Data(count: 16)
    let bytes = Array("Mock".utf8)
    for i in 0..<bytes.count { name[i] = bytes[i] }
    buf.append(name)
    buf.append(contentsOf: [1, 0, 0])
    buf.append(contentsOf: [0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04])
    buf.append(0x00)              // OTA capable = false
    buf.append(4)                  // 4 pins
    for _ in 0..<4 { buf.append(0x0F) }
    buf.append(contentsOf: [1, 0, 1])     // I2C, SPI, UART
    buf.append(contentsOf: [0x00, 0x01]) // max payload = 256
    buf.append(0)                  // 0 modules
    buf.append(0)                  // 0 datastreams
    return buf
}

@available(iOS 15.0, macOS 12.0, *)
final class ModulesTests: XCTestCase {

    /// Build a connected device backed by the given mock with HELLO + ACK
    /// auto-responders pre-installed. The mock is returned for inspection.
    private func connectedDevice() async throws -> (ConduytDevice, MockTransport) {
        let mock = MockTransport()
        mock.helloResp(helloRespPayload())
        mock.ackModCmd()
        let device = ConduytDevice(transport: mock, timeout: 1.0)
        _ = try await device.connect()
        return (device, mock)
    }

    // MARK: - Servo

    func testServoAttach() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytServo(device: device, moduleID: 0x07).attach(pin: 9, minUs: 1000, maxUs: 2000)
        let p = try mock.nthModCmdPayload(0)
        XCTAssertEqual(p, Data([0x07, 0x01, 9, 0xE8, 0x03, 0xD0, 0x07]))
    }

    func testServoWrite() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytServo(device: device, moduleID: 0x07).write(angle: 90)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x07, 0x02, 90]))
    }

    func testServoWriteMicroseconds() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytServo(device: device, moduleID: 0x07).writeMicroseconds(1500)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x07, 0x03, 0xDC, 0x05]))
    }

    func testServoDetach() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytServo(device: device, moduleID: 0x07).detach()
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x07, 0x04]))
    }

    // MARK: - NeoPixel

    func testNeoPixelBegin() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).begin(pin: 6, count: 64)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x01, 6, 0x40, 0x00, 0]))
    }

    func testNeoPixelSetPixelNoWhite() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).setPixel(5, r: 255, g: 128, b: 0)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x02, 5, 0, 255, 128, 0]))
    }

    func testNeoPixelSetPixelWithWhite() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).setPixel(5, r: 255, g: 128, b: 0, w: 200)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x02, 5, 0, 255, 128, 0, 200]))
    }

    func testNeoPixelSetRange() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).setRange(start: 4, count: 8, r: 1, g: 2, b: 3)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x03, 4, 0, 8, 0, 1, 2, 3]))
    }

    func testNeoPixelFill() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).fill(r: 10, g: 20, b: 30)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x04, 10, 20, 30]))
    }

    func testNeoPixelShow() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).show()
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x05]))
    }

    func testNeoPixelSetBrightness() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytNeoPixel(device: device, moduleID: 0x03).setBrightness(200)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x03, 0x06, 200]))
    }

    // MARK: - OLED

    func testOLEDBegin() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytOLED(device: device, moduleID: 0x05).begin(width: 128, height: 64, addr: 0x3C)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x05, 0x01, 128, 64, 0x3C]))
    }

    func testOLEDText() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytOLED(device: device, moduleID: 0x05).text(x: 0, y: 8, size: 1, "Hi")
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x05, 0x03, 0, 8, 1, 0x48, 0x69]))
    }

    func testOLEDDrawRectFilled() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytOLED(device: device, moduleID: 0x05).drawRect(x: 1, y: 2, w: 3, h: 4, fill: true)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x05, 0x04, 1, 2, 3, 4, 1]))
    }

    func testOLEDShow() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytOLED(device: device, moduleID: 0x05).show()
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x05, 0x06]))
    }

    // MARK: - DHT

    func testDHTBegin() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytDHT(device: device, moduleID: 0x09).begin(pin: 4, kind: 22)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x09, 0x01, 4, 22]))
    }

    func testDHTReadDecodesFloats() async throws {
        let mock = MockTransport()
        mock.helloResp(helloRespPayload())
        let temp: Float = 23.5
        let hum:  Float = 45.0
        var resp = Data([0x09])
        resp.appendLE(float32: temp)
        resp.appendLE(float32: hum)
        mock.modRespModCmd(resp)
        let device = ConduytDevice(transport: mock, timeout: 1.0)
        _ = try await device.connect()

        let r = try await ConduytDHT(device: device, moduleID: 0x09).read()
        XCTAssertEqual(r.temperatureC, 23.5)
        XCTAssertEqual(r.humidityPct, 45.0)
    }

    // MARK: - Encoder

    func testEncoderAttach() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytEncoder(device: device, moduleID: 0x0A).attach(pinA: 2, pinB: 3)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x0A, 0x01, 2, 3]))
    }

    func testEncoderReadDecodesInt32() async throws {
        let mock = MockTransport()
        mock.helloResp(helloRespPayload())
        var resp = Data([0x0A])
        resp.appendLE(int32: -12345)
        mock.modRespModCmd(resp)
        let device = ConduytDevice(transport: mock, timeout: 1.0)
        _ = try await device.connect()

        let n = try await ConduytEncoder(device: device, moduleID: 0x0A).read()
        XCTAssertEqual(n, -12345)
    }

    // MARK: - Stepper

    func testStepperConfig() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytStepper(device: device, moduleID: 0x0C).config(stepPin: 2, dirPin: 3, enPin: 4, stepsPerRev: 200)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x0C, 0x01, 2, 3, 4, 0xC8, 0x00]))
    }

    func testStepperMoveNegative() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytStepper(device: device, moduleID: 0x0C).move(steps: -100, speedHz: 1000)
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x0C, 0x02, 0x9C, 0xFF, 0xFF, 0xFF, 0xE8, 0x03]))
    }

    func testStepperStop() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytStepper(device: device, moduleID: 0x0C).stop()
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x0C, 0x04]))
    }

    // MARK: - PID

    func testPIDConfigEncodesFloats() async throws {
        let (device, mock) = try await connectedDevice()
        try await ConduytPID(device: device, moduleID: 0x0E).config(kp: 1.0, ki: 0.5, kd: 0.1)
        var want = Data([0x0E, 0x01])
        want.appendLE(float32: 1.0)
        want.appendLE(float32: 0.5)
        want.appendLE(float32: 0.1)
        XCTAssertEqual(try mock.nthModCmdPayload(0), want)
    }

    func testPIDEnableDisable() async throws {
        let (device, mock) = try await connectedDevice()
        let pid = ConduytPID(device: device, moduleID: 0x0E)
        try await pid.enable()
        try await pid.disable()
        XCTAssertEqual(try mock.nthModCmdPayload(0), Data([0x0E, 0x05, 1]))
        XCTAssertEqual(try mock.nthModCmdPayload(1), Data([0x0E, 0x05, 0]))
    }
}
