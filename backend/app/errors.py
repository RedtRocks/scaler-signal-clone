"""Domain errors raised by services. `app.main` turns them into `{"detail": ...}` responses,
so business logic never imports FastAPI's HTTP types."""


class DomainError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class BadRequest(DomainError):
    status_code = 400


class Forbidden(DomainError):
    status_code = 403


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409
