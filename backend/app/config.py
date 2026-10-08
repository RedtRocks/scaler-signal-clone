"""Settings read from environment variables (or a backend/.env file)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./signal.db"
    media_dir: Path = Path("./media")
    # Comma-separated list, e.g. "http://localhost:3000,https://signal.example.com"
    allowed_origins: str = "http://localhost:3000"
    fixed_otp: str = "123456"
    max_avatar_bytes: int = 2 * 1024 * 1024
    max_attachment_bytes: int = 10 * 1024 * 1024
    max_attachments_per_message: int = 10
    # Uploads no message claimed within this time are deleted by the background task.
    unclaimed_attachment_ttl_seconds: float = 3600.0
    expiry_interval_seconds: float = 5.0

    @property
    def allowed_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
