"""Test fixtures: SQLite database with seed + migration data."""

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from app.models.base import Base
import app.models.antibiotic  # noqa: F401 - register models

from scripts.seed_data import PATHOGENS, PENETRATION_SITES, CRCL_RANGES
from scripts.migrate_data import migrate


@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(eng, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    return eng


@pytest.fixture(scope="session")
def seeded_session(engine):
    """Session with seed data + migrated data (once per test session)."""
    from app.models.antibiotic import CrclRange, Pathogen, PenetrationSite

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    # Seed
    for p in PATHOGENS:
        session.add(Pathogen(**p))
    for s in PENETRATION_SITES:
        session.add(PenetrationSite(**s))
    for r in CRCL_RANGES:
        session.add(CrclRange(**r))
    session.commit()

    # Migrate
    migrate(session)

    yield session
    session.close()


@pytest.fixture()
def db(seeded_session) -> Session:
    """Per-test database session (uses shared seeded data)."""
    return seeded_session
