"""End-to-end migration test using SQLite (no PostgreSQL required).

Creates an in-memory SQLite database, runs seed + migration + verification.
This validates the full pipeline without external dependencies.

Run with: python -m scripts.test_migration_e2e
"""

import sys

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from scripts.migrate_data import migrate
from scripts.seed_data import (
    CRCL_RANGES,
    PATHOGENS,
    PENETRATION_SITES,
)
from scripts.verify_migration import verify

# Import all models so Base.metadata knows about them
import app.models.antibiotic  # noqa: F401


def _setup_sqlite_enums(engine):
    """SQLite doesn't support ENUM types natively. This is handled by
    SQLAlchemy automatically (ENUMs become VARCHAR in SQLite)."""
    pass


def seed_sync(session):
    """Synchronous version of seed for SQLite testing."""
    from app.models.antibiotic import CrclRange, Pathogen, PenetrationSite
    from app.models.enums import PathogenType

    for p in PATHOGENS:
        session.add(Pathogen(**p))
    for s in PENETRATION_SITES:
        session.add(PenetrationSite(**s))
    for r in CRCL_RANGES:
        session.add(CrclRange(**r))
    session.commit()
    print(f"  Seeded: {len(PATHOGENS)} pathogens, {len(PENETRATION_SITES)} sites, {len(CRCL_RANGES)} CrCl ranges")


def main() -> None:
    print("=" * 60)
    print("End-to-End Migration Test (SQLite in-memory)")
    print("=" * 60)

    # Create SQLite in-memory engine
    engine = create_engine("sqlite:///:memory:", echo=False)

    # Enable foreign key enforcement for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create all tables from models
    print("\n[1/4] Creating schema...")
    Base.metadata.create_all(engine)
    table_count = len(Base.metadata.tables)
    print(f"  Created {table_count} tables")

    SessionLocal = sessionmaker(bind=engine)

    # Seed reference data
    print("\n[2/4] Seeding reference data...")
    with SessionLocal() as session:
        seed_sync(session)

    # Run migration
    print("\n[3/4] Running data migration from data.js...")
    with SessionLocal() as session:
        try:
            stats = migrate(session)
            print("\n  Migration stats:")
            for key, val in stats.items():
                print(f"    {key}: {val}")
        except Exception as e:
            print(f"\n  MIGRATION FAILED: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    # Verify
    print("\n[4/4] Verifying data integrity...")
    with SessionLocal() as session:
        passed, messages = verify(session)
        for msg in messages:
            print(msg)

    print()
    if passed:
        print("SUCCESS: All migration checks passed!")
        sys.exit(0)
    else:
        print("FAILURE: Some checks failed. Review output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
