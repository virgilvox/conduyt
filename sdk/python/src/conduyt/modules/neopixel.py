"""CONDUYT NeoPixel Module"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from conduyt.device import ConduytDevice

from conduyt.core.constants import CMD


class ConduytNeoPixel:
    def __init__(self, device: ConduytDevice, module_id: int = 0) -> None:
        self._device = device
        self._mod_id = module_id

    async def begin(self, pin: int, count: int, pixel_type: int = 0) -> None:
        payload = bytes([self._mod_id, 0x01, pin,
                         count & 0xFF, (count >> 8) & 0xFF, pixel_type])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def set_pixel(self, index: int, r: int, g: int, b: int, w: int = 0) -> None:
        payload = bytes([self._mod_id, 0x02,
                         index & 0xFF, (index >> 8) & 0xFF, r, g, b])
        if w:
            payload += bytes([w])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def set_range(self, start: int, count: int, r: int, g: int, b: int) -> None:
        payload = bytes([self._mod_id, 0x03,
                         start & 0xFF, (start >> 8) & 0xFF,
                         count & 0xFF, (count >> 8) & 0xFF, r, g, b])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def fill(self, r: int, g: int, b: int, w: int = 0) -> None:
        payload = bytes([self._mod_id, 0x04, r, g, b])
        if w:
            payload += bytes([w])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def show(self) -> None:
        payload = bytes([self._mod_id, 0x05])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def set_brightness(self, brightness: int) -> None:
        payload = bytes([self._mod_id, 0x06, brightness & 0xFF])
        await self._device._send_command(CMD.MOD_CMD, payload)
