"""Custom HTTP error classes for PubHubs modules."""


class HTTPError(Exception):
    """Base class for HTTP errors that know how to respond."""
    status: int = 500

    def __init__(self, message: str = "An error occurred."):
        self.message = message
        super().__init__(message)

    def to_response(self) -> dict:
        return {"error": self.message}


class BadRequestError(HTTPError):
    """400 Bad Request."""
    status = 400


class ForbiddenError(HTTPError):
    """403 Forbidden."""
    status = 403

    def __init__(self, message: str = "You need appropriate permissions to access this resource."):
        super().__init__(message)

    def to_response(self) -> dict:
        return {"message": self.message}


class InsufficientPowerLevelError(ForbiddenError):
    """Raised when a user lacks the required power level in a room."""

    def __init__(self, user_id: str, required: int, actual: int, room_id: str):
        self.user_id = user_id
        self.required = required
        self.actual = actual
        self.room_id = room_id
        super().__init__(f"User {user_id} has power level {actual}, requires {required} in room {room_id}")
