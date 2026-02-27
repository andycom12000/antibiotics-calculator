"""One-click reset and re-seed: runs seed_data then migrate_data.

Run with: python -m scripts.reset_and_seed
"""

import asyncio

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from scripts.migrate_data import migrate
from scripts.seed_data import seed


async def seed_async() -> None:
    """Run seed_data with async engine."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        await seed(session)
    await engine.dispose()


def migrate_sync() -> dict:
    """Run migrate_data with sync engine."""
    engine = create_engine(settings.DATABASE_URL_SYNC)
    SessionLocal = sessionmaker(bind=engine)
    with SessionLocal() as session:
        return migrate(session)


def main() -> None:
    print("=== Step 1: Seed lookup tables ===")
    asyncio.run(seed_async())

    print("\n=== Step 2: Migrate spreadsheet data + empiric rules ===")
    stats = migrate_sync()

    print("\n=== Reset & Seed Complete ===")
    for key, val in stats.items():
        print(f"  {key}: {val}")


if __name__ == "__main__":
    main()
