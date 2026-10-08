"""Database engine, session factory and the declarative base.

All timestamps are stored as naive UTC datetimes (SQLite has no time zone type);
`utcnow()` is the single source of "now" and the API layer appends the `Z`.
"""

from collections.abc import Iterator
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Database:
    """Owns one engine and its session factory. One instance lives on `app.state.db`."""

    def __init__(self, url: str) -> None:
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine: Engine = create_engine(url, connect_args=connect_args)
        if url.startswith("sqlite"):
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        # Import for the side effect of registering every table on Base.metadata.
        from app import models  # noqa: F401

        Base.metadata.create_all(self.engine)
        self._add_missing_columns()

    def _add_missing_columns(self) -> None:
        """create_all never alters an existing table. Add nullable columns introduced after a
        database was first created, so an existing SQLite file keeps working without a migration."""
        inspector = inspect(self.engine)
        with self.engine.begin() as connection:
            for table in Base.metadata.sorted_tables:
                if not inspector.has_table(table.name):
                    continue
                present = {column["name"] for column in inspector.get_columns(table.name)}
                for column in table.columns:
                    if column.name not in present and column.nullable:
                        kind = column.type.compile(dialect=self.engine.dialect)
                        connection.execute(
                            text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {kind}')
                        )

    def drop_all(self) -> None:
        from app import models  # noqa: F401

        Base.metadata.drop_all(self.engine)

    def session(self) -> Session:
        return self.session_factory()


def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    # SQLite ignores FOREIGN KEY / ON DELETE CASCADE unless this is set per connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, closed afterwards."""
    with request.app.state.db.session() as session:
        yield session
