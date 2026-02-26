"""Verify migrated data integrity.

Compares database contents against source data.js to ensure
nothing was lost or corrupted during migration.

Run with: python -m scripts.verify_migration
"""

from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.antibiotic import (
    Antibiotic,
    AntibioticCoverage,
    AntibioticNote,
    AntibioticPenetration,
    CrclRange,
    DialysisDosage,
    DosageRegimen,
    DosageValue,
    EmpiricRecommendation,
    EmpiricSyndrome,
    Pathogen,
    PenetrationSite,
)
from scripts.migrate_data import parse_data_js

DATA_JS_PATH = Path(__file__).resolve().parent.parent.parent / "data.js"


def verify(session: Session) -> tuple[bool, list[str]]:
    """Run all verifications. Returns (all_passed, messages)."""
    messages: list[str] = []
    all_passed = True

    antibiotics_data, empiric_data = parse_data_js(DATA_JS_PATH)

    # --- Table counts ---
    checks = [
        ("antibiotics", Antibiotic, len(antibiotics_data)),
        ("pathogens", Pathogen, 18),
        ("penetration_sites", PenetrationSite, 3),
        ("crcl_ranges", CrclRange, 12),
        ("empiric_syndromes", EmpiricSyndrome, len(empiric_data)),
    ]

    messages.append("=== Table Record Counts ===")
    for label, model, expected in checks:
        count = session.scalar(select(func.count()).select_from(model))
        status = "OK" if count == expected else "MISMATCH"
        if status == "MISMATCH":
            all_passed = False
        messages.append(f"  {label}: {count} (expected {expected}) [{status}]")

    # Other tables (no fixed expected count, just report)
    other_tables = [
        ("antibiotic_coverage", AntibioticCoverage),
        ("antibiotic_penetration", AntibioticPenetration),
        ("dosage_regimens", DosageRegimen),
        ("dosage_values", DosageValue),
        ("dialysis_dosages", DialysisDosage),
        ("antibiotic_notes", AntibioticNote),
        ("empiric_recommendations", EmpiricRecommendation),
    ]
    for label, model in other_tables:
        count = session.scalar(select(func.count()).select_from(model))
        messages.append(f"  {label}: {count}")

    # --- Spot checks ---
    messages.append("\n=== Spot Checks ===")

    # Check 1: Meropenem should have ESBL coverage
    mero = session.execute(
        select(Antibiotic).where(Antibiotic.name == "Meropenem")
    ).scalar_one_or_none()
    if mero:
        esbl = session.execute(select(Pathogen).where(Pathogen.code == "ESBL")).scalar_one_or_none()
        if esbl:
            cov = session.execute(
                select(AntibioticCoverage).where(
                    AntibioticCoverage.antibiotic_id == mero.id,
                    AntibioticCoverage.pathogen_id == esbl.id,
                )
            ).scalar_one_or_none()
            if cov and cov.is_covered:
                messages.append("  Meropenem covers ESBL: OK")
            else:
                messages.append("  Meropenem covers ESBL: FAIL")
                all_passed = False
    else:
        messages.append("  Meropenem not found: FAIL")
        all_passed = False

    # Check 2: Tazocin should have 3 dosage regimens
    tazocin = session.execute(
        select(Antibiotic).where(Antibiotic.name.contains("Tazocin"))
    ).scalar_one_or_none()
    if tazocin:
        reg_count = session.scalar(
            select(func.count()).select_from(DosageRegimen).where(
                DosageRegimen.antibiotic_id == tazocin.id
            )
        )
        if reg_count == 3:
            messages.append(f"  Tazocin has {reg_count} regimens: OK")
        else:
            messages.append(f"  Tazocin has {reg_count} regimens (expected 3): FAIL")
            all_passed = False

        # Tazocin should have HD, PD, CRRT dialysis dosages
        dial_count = session.scalar(
            select(func.count()).select_from(DialysisDosage)
            .join(DosageRegimen)
            .where(DosageRegimen.antibiotic_id == tazocin.id)
        )
        if dial_count == 3:
            messages.append(f"  Tazocin has {dial_count} dialysis dosages: OK")
        else:
            messages.append(f"  Tazocin has {dial_count} dialysis dosages (expected 3): FAIL")
            all_passed = False

    # Check 3: Ceftriaxone should penetrate BBB
    ceftriaxone = session.execute(
        select(Antibiotic).where(Antibiotic.name.contains("Ceftriaxone"))
    ).scalar_one_or_none()
    if ceftriaxone:
        bbb = session.execute(
            select(PenetrationSite).where(PenetrationSite.code == "BBB")
        ).scalar_one_or_none()
        if bbb:
            pen = session.execute(
                select(AntibioticPenetration).where(
                    AntibioticPenetration.antibiotic_id == ceftriaxone.id,
                    AntibioticPenetration.site_id == bbb.id,
                )
            ).scalar_one_or_none()
            if pen:
                messages.append("  Ceftriaxone penetrates BBB: OK")
            else:
                messages.append("  Ceftriaxone penetrates BBB: FAIL")
                all_passed = False

    # Check 4: Acyclovir should be antiviral
    acyclovir = session.execute(
        select(Antibiotic).where(Antibiotic.name == "Acyclovir")
    ).scalar_one_or_none()
    if acyclovir:
        if acyclovir.agent_type.value == "antiviral":
            messages.append("  Acyclovir agent_type=antiviral: OK")
        else:
            messages.append(f"  Acyclovir agent_type={acyclovir.agent_type}: FAIL (expected antiviral)")
            all_passed = False

    # Check 5: Fluconazole should be antifungal
    fluconazole = session.execute(
        select(Antibiotic).where(Antibiotic.name == "Fluconazole")
    ).scalar_one_or_none()
    if fluconazole:
        if fluconazole.agent_type.value == "antifungal":
            messages.append("  Fluconazole agent_type=antifungal: OK")
        else:
            messages.append(f"  Fluconazole agent_type={fluconazole.agent_type}: FAIL (expected antifungal)")
            all_passed = False

    # Check 6: Vancomycin should have comments (notes)
    vanco = session.execute(
        select(Antibiotic).where(Antibiotic.name == "Vancomycin")
    ).scalar_one_or_none()
    if vanco:
        note_count = session.scalar(
            select(func.count()).select_from(AntibioticNote).where(
                AntibioticNote.antibiotic_id == vanco.id
            )
        )
        if note_count > 0:
            messages.append(f"  Vancomycin has {note_count} note(s): OK")
        else:
            messages.append("  Vancomycin has no notes: FAIL")
            all_passed = False

    # Check 7: Every antibiotic in data.js should exist in DB
    messages.append("\n=== Name Matching ===")
    missing = []
    for ab_data in antibiotics_data:
        name = ab_data["name"]
        exists = session.execute(
            select(Antibiotic).where(Antibiotic.name == name)
        ).scalar_one_or_none()
        if not exists:
            missing.append(name)
    if missing:
        messages.append(f"  Missing antibiotics: {missing}")
        all_passed = False
    else:
        messages.append(f"  All {len(antibiotics_data)} antibiotics found in DB: OK")

    # --- Summary ---
    messages.append(f"\n=== RESULT: {'ALL PASSED' if all_passed else 'SOME CHECKS FAILED'} ===")

    return all_passed, messages


def main() -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL_SYNC)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as session:
        passed, messages = verify(session)

    for msg in messages:
        print(msg)


if __name__ == "__main__":
    main()
