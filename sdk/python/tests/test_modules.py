"""Module wrapper tests — verify MOD_CMD payloads for all 7 modules."""

import struct
from unittest.mock import AsyncMock, patch

import pytest

from conduyt.device import ConduytDevice
from conduyt.transports.mock import MockTransport
from conduyt.core.constants import CMD, EVT
from conduyt.core.wire import wire_encode, wire_decode, make_packet

from conduyt.modules.servo import ConduytServo
from conduyt.modules.neopixel import ConduytNeoPixel
from conduyt.modules.oled import ConduytOLED
from conduyt.modules.dht import ConduytDHT, DHTReading
from conduyt.modules.encoder import ConduytEncoder
from conduyt.modules.stepper import ConduytStepper
from conduyt.modules.pid import ConduytPID


@pytest.fixture
def mock_device():
    """Create a device with a mocked _send_command that returns empty bytes."""
    transport = MockTransport()
    device = ConduytDevice(transport)
    device._send_command = AsyncMock(return_value=b"")
    return device


# ---- Servo ----

class TestConduytServo:
    @pytest.mark.asyncio
    async def test_attach(self, mock_device):
        servo = ConduytServo(mock_device, module_id=2)
        await servo.attach(pin=9, min_us=544, max_us=2400)

        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD,
            bytes([2, 0x01, 9,
                   544 & 0xFF, (544 >> 8) & 0xFF,
                   2400 & 0xFF, (2400 >> 8) & 0xFF]),
        )

    @pytest.mark.asyncio
    async def test_write(self, mock_device):
        servo = ConduytServo(mock_device)
        await servo.write(90)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x02, 90])
        )

    @pytest.mark.asyncio
    async def test_write_microseconds(self, mock_device):
        servo = ConduytServo(mock_device)
        await servo.write_microseconds(1500)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x03, 1500 & 0xFF, (1500 >> 8) & 0xFF])
        )

    @pytest.mark.asyncio
    async def test_detach(self, mock_device):
        servo = ConduytServo(mock_device)
        await servo.detach()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x04])
        )


# ---- NeoPixel ----

class TestConduytNeoPixel:
    @pytest.mark.asyncio
    async def test_begin(self, mock_device):
        neo = ConduytNeoPixel(mock_device, module_id=1)
        await neo.begin(pin=6, count=30, pixel_type=0)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD,
            bytes([1, 0x01, 6, 30, 0, 0]),
        )

    @pytest.mark.asyncio
    async def test_set_pixel(self, mock_device):
        neo = ConduytNeoPixel(mock_device)
        await neo.set_pixel(index=5, r=255, g=128, b=0)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD,
            bytes([0, 0x02, 5, 0, 255, 128, 0]),
        )

    @pytest.mark.asyncio
    async def test_set_pixel_with_white(self, mock_device):
        neo = ConduytNeoPixel(mock_device)
        await neo.set_pixel(index=0, r=10, g=20, b=30, w=40)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD,
            bytes([0, 0x02, 0, 0, 10, 20, 30, 40]),
        )

    @pytest.mark.asyncio
    async def test_fill(self, mock_device):
        neo = ConduytNeoPixel(mock_device)
        await neo.fill(r=100, g=200, b=50)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD,
            bytes([0, 0x04, 100, 200, 50]),
        )

    @pytest.mark.asyncio
    async def test_show(self, mock_device):
        neo = ConduytNeoPixel(mock_device)
        await neo.show()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x05])
        )

    @pytest.mark.asyncio
    async def test_set_brightness(self, mock_device):
        neo = ConduytNeoPixel(mock_device)
        await neo.set_brightness(128)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x06, 128])
        )


# ---- OLED ----

class TestConduytOLED:
    @pytest.mark.asyncio
    async def test_begin(self, mock_device):
        oled = ConduytOLED(mock_device)
        await oled.begin(width=128, height=64, i2c_addr=0x3C)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x01, 128, 64, 0x3C])
        )

    @pytest.mark.asyncio
    async def test_clear(self, mock_device):
        oled = ConduytOLED(mock_device)
        await oled.clear()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x02])
        )

    @pytest.mark.asyncio
    async def test_text(self, mock_device):
        oled = ConduytOLED(mock_device)
        await oled.text(x=10, y=20, size=1, text="Hi")
        expected = bytes([0, 0x03, 10, 20, 1]) + b"Hi"
        mock_device._send_command.assert_called_once_with(CMD.MOD_CMD, expected)

    @pytest.mark.asyncio
    async def test_show(self, mock_device):
        oled = ConduytOLED(mock_device)
        await oled.show()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x06])
        )


# ---- DHT ----

class TestConduytDHT:
    @pytest.mark.asyncio
    async def test_begin(self, mock_device):
        dht = ConduytDHT(mock_device)
        await dht.begin(pin=4, sensor_type=22)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x01, 4, 22])
        )

    @pytest.mark.asyncio
    async def test_read(self, mock_device):
        # Mock response: module_id(1) + temperature(float32) + humidity(float32)
        temp = 23.5
        hum = 65.0
        resp = bytes([0]) + struct.pack("<ff", temp, hum)
        mock_device._send_command = AsyncMock(return_value=resp)

        dht = ConduytDHT(mock_device)
        reading = await dht.read()

        assert isinstance(reading, DHTReading)
        assert abs(reading.temperature - 23.5) < 0.01
        assert abs(reading.humidity - 65.0) < 0.01

    @pytest.mark.asyncio
    async def test_read_short_response(self, mock_device):
        mock_device._send_command = AsyncMock(return_value=b"")
        dht = ConduytDHT(mock_device)
        reading = await dht.read()
        assert reading.temperature == 0.0
        assert reading.humidity == 0.0


# ---- Encoder ----

class TestConduytEncoder:
    @pytest.mark.asyncio
    async def test_attach(self, mock_device):
        enc = ConduytEncoder(mock_device)
        await enc.attach(pin_a=2, pin_b=3)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x01, 2, 3])
        )

    @pytest.mark.asyncio
    async def test_read(self, mock_device):
        # Mock response: module_id(1) + int32 LE = 1234
        resp = bytes([0]) + struct.pack("<i", 1234)
        mock_device._send_command = AsyncMock(return_value=resp)

        enc = ConduytEncoder(mock_device)
        value = await enc.read()
        assert value == 1234

    @pytest.mark.asyncio
    async def test_read_negative(self, mock_device):
        resp = bytes([0]) + struct.pack("<i", -500)
        mock_device._send_command = AsyncMock(return_value=resp)

        enc = ConduytEncoder(mock_device)
        value = await enc.read()
        assert value == -500

    @pytest.mark.asyncio
    async def test_reset(self, mock_device):
        enc = ConduytEncoder(mock_device)
        await enc.reset()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x03])
        )


# ---- Stepper ----

class TestConduytStepper:
    @pytest.mark.asyncio
    async def test_config(self, mock_device):
        stepper = ConduytStepper(mock_device)
        await stepper.config(step_pin=10, dir_pin=11, en_pin=12, steps_per_rev=200)
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD,
            bytes([0, 0x01, 10, 11, 12, 200 & 0xFF, (200 >> 8) & 0xFF]),
        )

    @pytest.mark.asyncio
    async def test_move(self, mock_device):
        stepper = ConduytStepper(mock_device)
        await stepper.move(steps=400, speed_hz=1000)
        expected = bytes([0, 0x02]) + struct.pack("<ih", 400, 1000)
        mock_device._send_command.assert_called_once_with(CMD.MOD_CMD, expected)

    @pytest.mark.asyncio
    async def test_move_to(self, mock_device):
        stepper = ConduytStepper(mock_device)
        await stepper.move_to(position=800, speed_hz=500)
        expected = bytes([0, 0x03]) + struct.pack("<ih", 800, 500)
        mock_device._send_command.assert_called_once_with(CMD.MOD_CMD, expected)

    @pytest.mark.asyncio
    async def test_stop(self, mock_device):
        stepper = ConduytStepper(mock_device)
        await stepper.stop()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x04])
        )


# ---- PID ----

class TestConduytPID:
    @pytest.mark.asyncio
    async def test_config(self, mock_device):
        pid = ConduytPID(mock_device)
        await pid.config(kp=1.0, ki=0.5, kd=0.1)
        expected = bytes([0, 0x01]) + struct.pack("<fff", 1.0, 0.5, 0.1)
        mock_device._send_command.assert_called_once_with(CMD.MOD_CMD, expected)

    @pytest.mark.asyncio
    async def test_set_target(self, mock_device):
        pid = ConduytPID(mock_device)
        await pid.set_target(100.0)
        expected = bytes([0, 0x02]) + struct.pack("<f", 100.0)
        mock_device._send_command.assert_called_once_with(CMD.MOD_CMD, expected)

    @pytest.mark.asyncio
    async def test_enable(self, mock_device):
        pid = ConduytPID(mock_device)
        await pid.enable()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x05, 1])
        )

    @pytest.mark.asyncio
    async def test_disable(self, mock_device):
        pid = ConduytPID(mock_device)
        await pid.disable()
        mock_device._send_command.assert_called_once_with(
            CMD.MOD_CMD, bytes([0, 0x05, 0])
        )
