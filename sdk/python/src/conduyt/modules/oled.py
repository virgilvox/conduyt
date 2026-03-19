"""CONDUYT OLED SSD1306 Module"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from conduyt.device import ConduytDevice

from conduyt.core.constants import CMD


class ConduytOLED:
    def __init__(self, device: ConduytDevice, module_id: int = 0) -> None:
        self._device = device
        self._mod_id = module_id

    async def begin(self, width: int = 128, height: int = 64, i2c_addr: int = 0x3C) -> None:
        payload = bytes([self._mod_id, 0x01, width, height, i2c_addr])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def clear(self) -> None:
        payload = bytes([self._mod_id, 0x02])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def text(self, x: int, y: int, size: int, text: str) -> None:
        text_bytes = text.encode("utf-8")
        payload = bytes([self._mod_id, 0x03, x, y, size]) + text_bytes
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def draw_rect(self, x: int, y: int, w: int, h: int, fill: bool = False) -> None:
        payload = bytes([self._mod_id, 0x04, x, y, w, h, 1 if fill else 0])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def draw_bitmap(self, x: int, y: int, w: int, h: int, data: bytes) -> None:
        payload = bytes([self._mod_id, 0x05, x, y, w, h]) + data
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def show(self) -> None:
        payload = bytes([self._mod_id, 0x06])
        await self._device._send_command(CMD.MOD_CMD, payload)
