"""Verify migrated data integrity.

Compares database contents against spreadsheet_data.json to ensure
nothing was lost or corrupted during migration.

Run with: python -m scripts.verify_migration
"""

import json
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
    Toxicity,
)
from scripts.migrate_data import parse_data_js

SCRIPT_DIR = Path(__file__).resolve().parent
SPREADSHEET_JSON = SCRIPT_DIR / "spreadsheet_data.json"
DATA_JS_PATH = SCRIPT_DIR.parent.parent / "data.js"


def verify(session: Session) -> tuple[bool, list[str]]:
    """Run all verifications. Returns (all_passed, messages)."""
    messages: list[str] = []
    all_passed = True

    # Load source data for comparison
    ss_data = json.loads(SPREADSHEET_JSON.read_text(encoding="utf-8"))
    expected_drugs = ss_data["drug_count"]
    expected_regimens = ss_data["regimen_count"]
    _, empiric_data = parse_data_js(DATA_JS_PATH)

    # --- Table counts ---
    checks = [
        ("antibiotics", Antibiotic, expected_drugs),
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

    # Check dosage regimens count
    reg_count = session.scalar(select(func.count()).select_from(DosageRegimen))
    reg_status = "OK" if reg_count == expected_regimens else "MISMATCH"
    if reg_status == "MISMATCH":
        all_passed = False
    messages.append(f"  dosage_regimens: {reg_count} (expected {expected_regimens}) [{reg_status}]")

    # Other tables (report only)
    other_tables = [
        ("antibiotic_coverage", AntibioticCoverage),
        ("antibiotic_penetration", AntibioticPenetration),
        ("dosage_values", DosageValue),
        ("dialysis_dosages", DialysisDosage),
        ("antibiotic_notes", AntibioticNote),
        ("toxicities", Toxicity),
        ("empiric_recommendations", EmpiricRecommendation),
    ]
    for label, model in other_tables:
        count = session.scalar(select(func.count()).select_from(model))
        messages.append(f"  {label}: {count}")

    # --- Spot checks from plan verification requirements ---
    messages.append("\n=== Spot Checks ===")

    def _check_coverage(drug_name, pathogen_code, expected_covered=True):
        ab = session.execute(
            select(Antibiotic).where(Antibiotic.name.contains(drug_name))
        ).scalar_one_or_none()
        if not ab:
            messages.append(f"  {drug_name} not found: FAIL")
            return False
        pathogen = session.execute(
            select(Pathogen).where(Pathogen.code == pathogen_code)
        ).scalar_one_or_none()
        if not pathogen:
            messages.append(f"  Pathogen {pathogen_code} not found: FAIL")
            return False
        cov = session.execute(
            select(AntibioticCoverage).where(
                AntibioticCoverage.antibiotic_id == ab.id,
                AntibioticCoverage.pathogen_id == pathogen.id,
            )
        ).scalar_one_or_none()
        covered = cov and cov.is_covered if cov else False
        ok = covered == expected_covered
        status = "OK" if ok else "FAIL"
        messages.append(f"  {drug_name} covers {pathogen_code}: {status}")
        if not ok:
            return False
        return True

    # 1. Ertapenem coverage: Anae:++, ESBL:v, MDRAB:v
    ok1 = _check_coverage("Ertapenem", "Anae")
    ok2 = _check_coverage("Ertapenem", "ESBL")
    ok3 = _check_coverage("Ertapenem", "MDRAB")
    if not (ok1 and ok2 and ok3):
        all_passed = False

    # 2. Tazocin coverage: PsA:+, Anae:++
    ok1 = _check_coverage("Tazocin", "PsA")
    ok2 = _check_coverage("Tazocin", "Anae")
    if not (ok1 and ok2):
        all_passed = False

    # 3. Levofloxacin coverage
    ok1 = _check_coverage("Levofloxacin", "MSSA")
    ok2 = _check_coverage("Levofloxacin", "Efc")
    ok3 = _check_coverage("Levofloxacin", "Atyp")
    ok4 = _check_coverage("Levofloxacin", "Steno")
    if not (ok1 and ok2 and ok3 and ok4):
        all_passed = False

    # 4. Metronidazole: coverage Anae:++, penetration BBB
    ok1 = _check_coverage("Metronidazole", "Anae")
    if not ok1:
        all_passed = False
    metro = session.execute(
        select(Antibiotic).where(Antibiotic.name == "Metronidazole")
    ).scalar_one_or_none()
    if metro:
        bbb = session.execute(
            select(PenetrationSite).where(PenetrationSite.code == "BBB")
        ).scalar_one_or_none()
        if bbb:
            pen = session.execute(
                select(AntibioticPenetration).where(
                    AntibioticPenetration.antibiotic_id == metro.id,
                    AntibioticPenetration.site_id == bbb.id,
                )
            ).scalar_one_or_none()
            if pen:
                messages.append("  Metronidazole penetrates BBB: OK")
            else:
                messages.append("  Metronidazole penetrates BBB: FAIL")
                all_passed = False

    # 5. Teicoplanin should have 4 regimens
    teico = session.execute(
        select(Antibiotic).where(Antibiotic.name == "Teicoplanin")
    ).scalar_one_or_none()
    if teico:
        tcount = session.scalar(
            select(func.count()).select_from(DosageRegimen).where(
                DosageRegimen.antibiotic_id == teico.id
            )
        )
        if tcount == 4:
            messages.append(f"  Teicoplanin has {tcount} regimens: OK")
        else:
            messages.append(f"  Teicoplanin has {tcount} regimens (expected 4): FAIL")
            all_passed = False

    # 6. Tigecycline standard dose should be 50mg Q12h (not 25mg)
    tige = session.execute(
        select(Antibiotic).where(Antibiotic.name.contains("Tigecycline"))
    ).scalar_one_or_none()
    if tige:
        normal_crcl = session.execute(
            select(CrclRange).where(CrclRange.label == "Normal")
        ).scalar_one_or_none()
        first_reg = session.execute(
            select(DosageRegimen).where(
                DosageRegimen.antibiotic_id == tige.id
            ).order_by(DosageRegimen.sort_order).limit(1)
        ).scalar_one_or_none()
        if first_reg and normal_crcl:
            dv = session.execute(
                select(DosageValue).where(
                    DosageValue.regimen_id == first_reg.id,
                    DosageValue.crcl_range_id == normal_crcl.id,
                )
            ).scalar_one_or_none()
            if dv and "50mg" in dv.dose_text:
                messages.append(f"  Tigecycline Normal dose contains 50mg: OK ({dv.dose_text})")
            else:
                dose = dv.dose_text if dv else "N/A"
                messages.append(f"  Tigecycline Normal dose: FAIL (got: {dose})")
                all_passed = False

    # 7. Acyclovir = antiviral, Fluconazole = antifungal
    for name, expected_type in [("Acyclovir", "antiviral"), ("Fluconazole", "antifungal")]:
        ab = session.execute(
            select(Antibiotic).where(Antibiotic.name == name)
        ).scalar_one_or_none()
        if ab:
            if ab.agent_type.value == expected_type:
                messages.append(f"  {name} agent_type={expected_type}: OK")
            else:
                messages.append(f"  {name} agent_type={ab.agent_type.value} (expected {expected_type}): FAIL")
                all_passed = False

    # 8. All spreadsheet drugs should exist in DB
    messages.append("\n=== Name Matching ===")
    missing = []
    for drug in ss_data["drugs"]:
        name = drug["name"]
        exists = session.execute(
            select(Antibiotic).where(Antibiotic.name == name)
        ).scalar_one_or_none()
        if not exists:
            missing.append(name)
    if missing:
        messages.append(f"  Missing antibiotics: {missing}")
        all_passed = False
    else:
        messages.append(f"  All {expected_drugs} antibiotics found in DB: OK")

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
