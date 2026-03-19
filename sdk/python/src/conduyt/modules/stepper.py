"""CONDUYT Stepper Module"""

from __future__ import annotations

import struct
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from conduyt.device import ConduytDevice

from conduyt.core.constants import CMD


class ConduytStepper:
    def __init__(self, device: ConduytDevice, module_id: int = 0) -> None:
        self._device = device
        self._mod_id = module_id

    async def config(self, step_pin: int, dir_pin: int, en_pin: int, steps_per_rev: int = 200) -> None:
        payload = bytes([self._mod_id, 0x01, step_pin, dir_pin, en_pin,
                         steps_per_rev & 0xFF, (steps_per_rev >> 8) & 0xFF])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def move(self, steps: int, speed_hz: int) -> None:
        payload = bytes([self._mod_id, 0x02]) + struct.pack("<ih", steps, speed_hz)
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def move_to(self, position: int, speed_hz: int) -> None:
        payload = bytes([self._mod_id, 0x03]) + struct.pack("<ih", position, speed_hz)
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def stop(self) -> None:
        payload = bytes([self._mod_id, 0x04])
        await self._device._send_command(CMD.MOD_CMD, payload)
