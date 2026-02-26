"""Seed reference/lookup data into the database.

Populates: pathogens, penetration_sites, crcl_ranges.
Run with: python -m scripts.seed_data
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.antibiotic import CrclRange, Pathogen, PenetrationSite
from app.models.enums import PathogenType

# ─── Pathogens ─────────────────────────────────────────────────────

PATHOGENS = [
    # spectrum (一般抗菌譜)
    {"code": "Strep", "name": "Streptococcus", "pathogen_type": PathogenType.spectrum, "sort_order": 1},
    {"code": "MSSA", "name": "Methicillin-Sensitive S. aureus", "pathogen_type": PathogenType.spectrum, "sort_order": 2},
    {"code": "Efc", "name": "Enterococcus faecalis", "pathogen_type": PathogenType.spectrum, "sort_order": 3},
    {"code": "Efm", "name": "Enterococcus faecium", "pathogen_type": PathogenType.spectrum, "sort_order": 4},
    {"code": "GNB", "name": "Gram-Negative Bacilli", "pathogen_type": PathogenType.spectrum, "sort_order": 5},
    {"code": "Enbac", "name": "Enterobacter", "pathogen_type": PathogenType.spectrum, "sort_order": 6},
    {"code": "PsA", "name": "Pseudomonas aeruginosa", "pathogen_type": PathogenType.spectrum, "sort_order": 7},
    {"code": "Ab", "name": "Acinetobacter baumannii", "pathogen_type": PathogenType.spectrum, "sort_order": 8},
    {"code": "Anae", "name": "Anaerobes", "pathogen_type": PathogenType.spectrum, "sort_order": 9},
    {"code": "Atyp", "name": "Atypical organisms", "pathogen_type": PathogenType.spectrum, "sort_order": 10},
    {"code": "Steno", "name": "Stenotrophomonas maltophilia", "pathogen_type": PathogenType.spectrum, "sort_order": 11},
    {"code": "Candida", "name": "Candida spp.", "pathogen_type": PathogenType.spectrum, "sort_order": 12},
    {"code": "Glabrata", "name": "Candida glabrata", "pathogen_type": PathogenType.spectrum, "sort_order": 13},
    # resistance (抗藥性)
    {"code": "MRSA", "name": "Methicillin-Resistant S. aureus", "pathogen_type": PathogenType.resistance, "sort_order": 14},
    {"code": "ESBL", "name": "Extended-Spectrum Beta-Lactamase", "pathogen_type": PathogenType.resistance, "sort_order": 15},
    {"code": "VRE", "name": "Vancomycin-Resistant Enterococcus", "pathogen_type": PathogenType.resistance, "sort_order": 16},
    {"code": "MDRAB", "name": "Multidrug-Resistant Acinetobacter baumannii", "pathogen_type": PathogenType.resistance, "sort_order": 17},
    {"code": "CRKP", "name": "Carbapenem-Resistant Klebsiella pneumoniae", "pathogen_type": PathogenType.resistance, "sort_order": 18},
]

# ─── Penetration Sites ────────────────────────────────────────────

PENETRATION_SITES = [
    {"code": "BBB", "name": "Blood-Brain Barrier (CNS)", "sort_order": 1},
    {"code": "Pros", "name": "Prostate / Epididymis", "sort_order": 2},
    {"code": "Endo", "name": "Endophthalmitis (Eye)", "sort_order": 3},
]

# ─── CrCl Ranges ──────────────────────────────────────────────────

CRCL_RANGES = [
    {"label": "<5", "lower_bound": None, "upper_bound": 5, "sort_order": 1},
    {"label": "5~10", "lower_bound": 5, "upper_bound": 10, "sort_order": 2},
    {"label": "10~15", "lower_bound": 10, "upper_bound": 15, "sort_order": 3},
    {"label": "15~20", "lower_bound": 15, "upper_bound": 20, "sort_order": 4},
    {"label": "20~25", "lower_bound": 20, "upper_bound": 25, "sort_order": 5},
    {"label": "25~30", "lower_bound": 25, "upper_bound": 30, "sort_order": 6},
    {"label": "30~40", "lower_bound": 30, "upper_bound": 40, "sort_order": 7},
    {"label": "40~50", "lower_bound": 40, "upper_bound": 50, "sort_order": 8},
    {"label": "50~60", "lower_bound": 50, "upper_bound": 60, "sort_order": 9},
    {"label": "60~80", "lower_bound": 60, "upper_bound": 80, "sort_order": 10},
    {"label": "80~90", "lower_bound": 80, "upper_bound": 90, "sort_order": 11},
    {"label": "Normal", "lower_bound": 90, "upper_bound": None, "sort_order": 12},
]


async def seed(session: AsyncSession) -> None:
    """Insert seed data if tables are empty."""

    # Pathogens
    result = await session.execute(select(Pathogen).limit(1))
    if result.scalar_one_or_none() is None:
        for p in PATHOGENS:
            session.add(Pathogen(**p))
        print(f"  Inserted {len(PATHOGENS)} pathogens")
    else:
        print("  Pathogens table already has data, skipping")

    # Penetration Sites
    result = await session.execute(select(PenetrationSite).limit(1))
    if result.scalar_one_or_none() is None:
        for s in PENETRATION_SITES:
            session.add(PenetrationSite(**s))
        print(f"  Inserted {len(PENETRATION_SITES)} penetration sites")
    else:
        print("  Penetration sites table already has data, skipping")

    # CrCl Ranges
    result = await session.execute(select(CrclRange).limit(1))
    if result.scalar_one_or_none() is None:
        for r in CRCL_RANGES:
            session.add(CrclRange(**r))
        print(f"  Inserted {len(CRCL_RANGES)} CrCl ranges")
    else:
        print("  CrCl ranges table already has data, skipping")

    await session.commit()
    print("Seed data complete.")


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        await seed(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
