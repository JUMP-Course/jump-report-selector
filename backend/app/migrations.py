from sqlalchemy import text

from app.database import engine


def _sqlite_columns(table_name: str) -> set[str]:
    with engine.connect() as connection:
        rows = connection.execute(text(f"PRAGMA table_info({table_name})")).mappings().all()
    return {str(row["name"]) for row in rows}


def _add_column_if_missing(table_name: str, column_name: str, definition: str) -> None:
    if column_name in _sqlite_columns(table_name):
        return
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def run_lightweight_migrations() -> None:
    """Small SQLite-friendly upgrades for deployments without Alembic yet."""
    if engine.dialect.name != "sqlite":
        return

    _add_column_if_missing("reports", "draw_history_id", "INTEGER REFERENCES draw_history(id)")
    _add_column_if_missing("questions", "question_source", "VARCHAR(20) NOT NULL DEFAULT 'manual'")
    _add_column_if_missing("questions", "draw_history_id", "INTEGER REFERENCES draw_history(id)")
    _add_column_if_missing("draw_history", "action_status", "VARCHAR(20) NOT NULL DEFAULT 'pending'")
    _add_column_if_missing("draw_history", "action_note", "TEXT")
