"""CONDUYT Encoder Module"""

from __future__ import annotations

import struct
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from conduyt.device import ConduytDevice

from conduyt.core.constants import CMD


class ConduytEncoder:
    def __init__(self, device: ConduytDevice, module_id: int = 0) -> None:
        self._device = device
        self._mod_id = module_id

    async def attach(self, pin_a: int, pin_b: int) -> None:
        payload = bytes([self._mod_id, 0x01, pin_a, pin_b])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def read(self) -> int:
        payload = bytes([self._mod_id, 0x02])
        resp = await self._device._send_command(CMD.MOD_CMD, payload)
        if len(resp) >= 5:  # module_id(1) + int32(4)
            return struct.unpack_from("<i", resp, 1)[0]
        return 0

    async def reset(self) -> None:
        payload = bytes([self._mod_id, 0x03])
        await self._device._send_command(CMD.MOD_CMD, payload)
