"""CONDUYT Error Types"""

from .constants import ERR_NAMES


class ConduytNAKError(Exception):
    """Raised when the device replies with a NAK packet."""

    def __init__(self, code: int, seq: int) -> None:
        name = ERR_NAMES.get(code, f"UNKNOWN_0x{code:02x}")
        super().__init__(f"NAK: {name} (code=0x{code:02x}, seq={seq})")
        self.code = code
        self.error_name = name
        self.seq = seq


class ConduytTimeoutError(Exception):
    """Raised when a command does not receive a response in time."""

    def __init__(self, seq: int, timeout_ms: int) -> None:
        super().__init__(f"Timeout: no response for seq={seq} after {timeout_ms}ms")
        self.seq = seq
        self.timeout_ms = timeout_ms


class ConduytDisconnectedError(Exception):
    """Raised when an operation is attempted on a disconnected device."""

    def __init__(self, message: str = "Device is not connected") -> None:
        super().__init__(message)
