"""Migrate data from spreadsheet JSON and data.js into normalized database tables.

Phase 1: Import antibiotics from spreadsheet_data.json (source of truth)
Phase 2: Import empiric rules from data.js

Run with: python -m scripts.migrate_data
"""

import json
import re
from pathlib import Path

from sqlalchemy import delete, select
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
from app.models.enums import (
    AgentType,
    AntibioticCategory,
    DialysisType,
    EmpiricTier,
    Route,
    ToxicityCategory,
)

SCRIPT_DIR = Path(__file__).resolve().parent
SPREADSHEET_JSON = SCRIPT_DIR / "spreadsheet_data.json"
DATA_JS_PATH = SCRIPT_DIR.parent.parent / "data.js"


# ─── Category & Agent Type Mapping ───────────────────────────────


CATEGORY_MAP: dict[str, tuple[AntibioticCategory, AgentType]] = {
    "Penicillins": (AntibioticCategory.penicillin, AgentType.antibacterial),
    "Cephalosporins": (AntibioticCategory.cephalosporin, AgentType.antibacterial),
    "Carbapenems": (AntibioticCategory.carbapenem, AgentType.antibacterial),
    "Fluoroquinolone": (AntibioticCategory.fluoroquinolone, AgentType.antibacterial),
    "Glyco/Lipo": (AntibioticCategory.glycopeptide, AgentType.antibacterial),
    "Oxazolid": (AntibioticCategory.oxazolidinone, AgentType.antibacterial),
    "Tetracyclines": (AntibioticCategory.tetracycline, AgentType.antibacterial),
    "Macrolides": (AntibioticCategory.macrolide, AgentType.antibacterial),
    "Lincosamide": (AntibioticCategory.lincosamide, AgentType.antibacterial),
    "Polymyxins": (AntibioticCategory.polymyxin, AgentType.antibacterial),
    "Aminoglycosides": (AntibioticCategory.aminoglycoside, AgentType.antibacterial),
    "OTHER": (AntibioticCategory.other, AgentType.antibacterial),
    "Antifungal": (AntibioticCategory.other, AgentType.antifungal),
    "Antifungal ": (AntibioticCategory.other, AgentType.antifungal),
    "Antiviral": (AntibioticCategory.other, AgentType.antiviral),
}

# Fallback detection rules for drugs without explicit category
_CATEGORY_RULES: list[tuple[str, AntibioticCategory]] = [
    ("Oxacillin", AntibioticCategory.penicillin),
    ("Ampicillin", AntibioticCategory.penicillin),
    ("Unasyn", AntibioticCategory.penicillin),
    ("Amsulber", AntibioticCategory.penicillin),
    ("Tazocin", AntibioticCategory.penicillin),
    ("Amox-Clav", AntibioticCategory.penicillin),
    ("Augmentin", AntibioticCategory.penicillin),
    ("Cef", AntibioticCategory.cephalosporin),
    ("Flomoxef", AntibioticCategory.cephalosporin),
    ("Brosym", AntibioticCategory.cephalosporin),
    ("Zavicefta", AntibioticCategory.cephalosporin),
    ("Ertapenem", AntibioticCategory.carbapenem),
    ("Meropenem", AntibioticCategory.carbapenem),
    ("Culin", AntibioticCategory.carbapenem),
    ("Imipenem", AntibioticCategory.carbapenem),
    ("Doripenem", AntibioticCategory.carbapenem),
    ("Ciprofloxacin", AntibioticCategory.fluoroquinolone),
    ("Levofloxacin", AntibioticCategory.fluoroquinolone),
    ("Moxifloxacin", AntibioticCategory.fluoroquinolone),
    ("Nemonoxacin", AntibioticCategory.fluoroquinolone),
    ("Teicoplanin", AntibioticCategory.glycopeptide),
    ("Vancomycin", AntibioticCategory.glycopeptide),
    ("Linezolid", AntibioticCategory.oxazolidinone),
    ("Minocycline", AntibioticCategory.tetracycline),
    ("Tigecycline", AntibioticCategory.tetracycline),
    ("Erythromycin", AntibioticCategory.macrolide),
    ("Azithromycin", AntibioticCategory.macrolide),
    ("Clindamycin", AntibioticCategory.lincosamide),
    ("Colistin", AntibioticCategory.polymyxin),
    ("polymyxin", AntibioticCategory.polymyxin),
    ("Bobimixyn", AntibioticCategory.polymyxin),
    ("Amikacin", AntibioticCategory.aminoglycoside),
    ("Daptomycin", AntibioticCategory.other),
]

_ANTIFUNGALS = {
    "Fluconazole", "Voriconazole", "Flucytosine", "Anidulafungin",
    "ERAXIS", "Isavuconazole", "Amphotericin",
}
_ANTIVIRALS = {"Acyclovir", "Ganciclovir", "Peramivir", "Rapiacta"}


def detect_category(name: str) -> AntibioticCategory:
    for pattern, cat in _CATEGORY_RULES:
        if pattern.lower() in name.lower():
            return cat
    return AntibioticCategory.other


def detect_agent_type(name: str) -> AgentType:
    for keyword in _ANTIFUNGALS:
        if keyword.lower() in name.lower():
            return AgentType.antifungal
    for keyword in _ANTIVIRALS:
        if keyword.lower() in name.lower():
            return AgentType.antiviral
    return AgentType.antibacterial


def detect_generation(name: str) -> str | None:
    m = re.search(r"\((\d)\s*°\s*\)", name)
    return f"{m.group(1)}°" if m else None


# ─── Route Mapping ───────────────────────────────────────────────


ROUTE_MAP = {
    "IV": Route.IV,
    "PO": Route.PO,
    "INHL": Route.INHL,
    "IV/PO": Route.IV_PO,
    "IV_PO": Route.IV_PO,
    "IV/IM": Route.IV_IM,
    "IV_IM": Route.IV_IM,
    "IM": Route.IM,
}


# ─── Toxicity Category Mapping ───────────────────────────────────


TOXICITY_KEY_MAP = {
    "general": ToxicityCategory.general,
    "renal": ToxicityCategory.renal,
    "hepatic": ToxicityCategory.hepatic,
    "cardiac": ToxicityCategory.cardiac,
    "neurologic": ToxicityCategory.neurologic,
    "musculoskeletal": ToxicityCategory.musculoskeletal,
    "gi": ToxicityCategory.gi,
    "skin": ToxicityCategory.skin,
    "obgyn": ToxicityCategory.obgyn,
    "hematologic": ToxicityCategory.hematologic,
    "endocrine": ToxicityCategory.endocrine,
}


# ─── JS Parsing (for empiric rules) ─────────────────────────────


def parse_data_js(path: Path) -> tuple[list[dict], list[dict]]:
    """Parse data.js and extract ANTIBIOTICS and EMPIRIC_RULES arrays."""
    text = path.read_text(encoding="utf-8")
    antibiotics = _extract_js_array(text, "ANTIBIOTICS")
    empiric_rules = _extract_js_array(text, "EMPIRIC_RULES")
    return antibiotics, empiric_rules


def _extract_js_array(text: str, var_name: str) -> list[dict]:
    pattern = rf"const\s+{var_name}\s*=\s*\["
    match = re.search(pattern, text)
    if not match:
        return []
    start = match.start()
    bracket_depth = 0
    array_start = text.index("[", start)
    for i in range(array_start, len(text)):
        if text[i] == "[":
            bracket_depth += 1
        elif text[i] == "]":
            bracket_depth -= 1
            if bracket_depth == 0:
                array_end = i + 1
                break
    js_array = text[array_start:array_end]
    json_str = _js_to_json(js_array)
    return json.loads(json_str)


def _js_to_json(js: str) -> str:
    s = js
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r"(?<=[{,\n])\s*(\w+)\s*:", r' "\1":', s)
    s = re.sub(r"'([^']*)'", r'"\1"', s)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s


# ─── Main Migration ───────────────────────────────────────────────


def migrate(session: Session) -> dict:
    """Run the full migration. Returns stats dict."""
    stats = {}

    # Load lookup tables
    pathogens = {p.code: p for p in session.execute(select(Pathogen)).scalars().all()}
    sites = {s.code: s for s in session.execute(select(PenetrationSite)).scalars().all()}
    crcl_ranges = {
        r.label: r for r in session.execute(select(CrclRange)).scalars().all()
    }

    if not pathogens:
        raise RuntimeError("Pathogens table is empty. Run seed_data first.")
    if not crcl_ranges:
        raise RuntimeError("CrCl ranges table is empty. Run seed_data first.")

    # ─── Phase 0: Clear existing data ─────────────────────────────
    # Delete antibiotics (CASCADE removes coverage, penetration, regimens,
    # dosage_values, dialysis_dosages, notes, toxicities, empiric_recommendations)
    session.execute(delete(EmpiricSyndrome))
    session.execute(delete(Antibiotic))
    session.flush()
    print("Cleared existing antibiotics and empiric data")

    # ─── Phase 1: Import antibiotics from spreadsheet JSON ────────
    data = json.loads(SPREADSHEET_JSON.read_text(encoding="utf-8"))
    drugs = data["drugs"]
    print(f"Loaded {len(drugs)} drugs from spreadsheet_data.json")

    antibiotic_map: dict[str, Antibiotic] = {}  # name → model

    for drug in drugs:
        name = drug["name"]
        category_raw = drug.get("category_raw")

        # Resolve category and agent_type
        if category_raw and category_raw in CATEGORY_MAP:
            category, agent_type = CATEGORY_MAP[category_raw]
        else:
            category = detect_category(name)
            agent_type = detect_agent_type(name)

        generation = drug.get("generation") or detect_generation(name)

        ab = Antibiotic(
            name=name,
            generic_name=None,
            category=category.value,
            agent_type=agent_type.value,
            generation=generation,
        )
        session.add(ab)
        session.flush()
        antibiotic_map[name] = ab

        # ─── Coverage ─────────────────────────────────────────
        coverage_data = drug.get("coverage") or {}
        for code, value in coverage_data.items():
            pathogen = pathogens.get(code)
            if pathogen is None:
                print(f"  WARNING: Unknown pathogen code '{code}' for {name}")
                continue
            is_covered = bool(value and value.strip())
            session.add(AntibioticCoverage(
                antibiotic_id=ab.id,
                pathogen_id=pathogen.id,
                is_covered=is_covered,
            ))

        # ─── Penetration ─────────────────────────────────────
        pen_data = drug.get("penetration") or {}
        for site_code in pen_data:
            site = sites.get(site_code)
            if site is None:
                continue
            session.add(AntibioticPenetration(
                antibiotic_id=ab.id,
                site_id=site.id,
            ))

        # ─── Regimens ─────────────────────────────────────────
        for j, reg_data in enumerate(drug.get("regimens", [])):
            route_str = reg_data.get("route", "IV")
            route = ROUTE_MAP.get(route_str, Route.IV)
            indication = reg_data.get("indication")

            regimen = DosageRegimen(
                antibiotic_id=ab.id,
                route=route.value,
                indication=indication,
                is_preferred=(j == 0),
                sort_order=j,
            )
            session.add(regimen)
            session.flush()

            # Dosage values for all CrCl ranges
            dosages = reg_data.get("dosages") or {}
            for label, dose_text in dosages.items():
                crcl = crcl_ranges.get(label)
                if crcl is None:
                    print(f"  WARNING: Unknown CrCl range '{label}' for {name}")
                    continue
                if dose_text and dose_text.strip():
                    session.add(DosageValue(
                        regimen_id=regimen.id,
                        crcl_range_id=crcl.id,
                        dose_text=dose_text.strip(),
                    ))

            # Dialysis dosages
            hd_text = reg_data.get("hd")
            crrt_text = reg_data.get("crrt")
            if hd_text and hd_text.strip() and hd_text.strip().lower() != "no data":
                session.add(DialysisDosage(
                    regimen_id=regimen.id,
                    dialysis_type=DialysisType.HD.value,
                    dose_text=hd_text.strip(),
                ))
            if crrt_text and crrt_text.strip() and crrt_text.strip().lower() != "no data":
                session.add(DialysisDosage(
                    regimen_id=regimen.id,
                    dialysis_type=DialysisType.CRRT.value,
                    dose_text=crrt_text.strip(),
                ))

        # ─── Notes ────────────────────────────────────────────
        notes_text = drug.get("notes")
        if notes_text and notes_text.strip():
            session.add(AntibioticNote(
                antibiotic_id=ab.id,
                note_type="other",
                content=notes_text.strip(),
            ))

        # ─── Toxicities ──────────────────────────────────────
        tox_data = drug.get("toxicities") or {}
        for tox_key, description in tox_data.items():
            tox_cat = TOXICITY_KEY_MAP.get(tox_key)
            if tox_cat is None:
                print(f"  WARNING: Unknown toxicity key '{tox_key}' for {name}")
                continue
            if description and description.strip():
                session.add(Toxicity(
                    antibiotic_id=ab.id,
                    category=tox_cat.value,
                    description=description.strip(),
                ))

    # Gather stats
    stats["antibiotics"] = len(antibiotic_map)
    stats["coverage_records"] = session.execute(
        select(AntibioticCoverage)
    ).scalars().all().__len__()
    stats["dosage_regimens"] = session.execute(
        select(DosageRegimen)
    ).scalars().all().__len__()
    stats["dosage_values"] = session.execute(
        select(DosageValue)
    ).scalars().all().__len__()
    stats["dialysis_dosages"] = session.execute(
        select(DialysisDosage)
    ).scalars().all().__len__()
    stats["toxicities"] = session.execute(
        select(Toxicity)
    ).scalars().all().__len__()

    # ─── Phase 2: Import empiric rules from data.js ───────────────
    _, empiric_data = parse_data_js(DATA_JS_PATH)
    print(f"Loaded {len(empiric_data)} empiric rules from data.js")

    empiric_count = 0
    for rule in empiric_data:
        syndrome_name = rule.get("syndrome", "")
        if not syndrome_name:
            continue

        syndrome = EmpiricSyndrome(name=syndrome_name)
        session.add(syndrome)
        session.flush()

        for tier_name, tier_enum in [
            ("primary", EmpiricTier.primary),
            ("severe", EmpiricTier.severe),
            ("alternative", EmpiricTier.alternative),
        ]:
            for ab_name_raw in rule.get(tier_name, []):
                ab_name_clean = ab_name_raw.split(" + ")[0].strip()
                ab = _fuzzy_match_antibiotic(ab_name_clean, antibiotic_map)
                if ab is None:
                    print(f"  WARNING: Empiric rule references unknown antibiotic '{ab_name_raw}'")
                    continue

                is_addon = " + " in ab_name_raw
                session.add(EmpiricRecommendation(
                    syndrome_id=syndrome.id,
                    antibiotic_id=ab.id,
                    tier=tier_enum.value,
                    is_addon=is_addon,
                    addon_notes=ab_name_raw if is_addon else None,
                ))
                empiric_count += 1

    stats["empiric_syndromes"] = len(empiric_data)
    stats["empiric_recommendations"] = empiric_count

    session.commit()
    return stats


def _fuzzy_match_antibiotic(name: str, antibiotic_map: dict[str, Antibiotic]) -> Antibiotic | None:
    """Match an antibiotic name from empiric rules to DB records."""
    # Direct match
    if name in antibiotic_map:
        return antibiotic_map[name]

    # Fuzzy: check if query is contained in any DB name or vice versa
    name_lower = name.lower()
    for key, ab in antibiotic_map.items():
        if name_lower in key.lower() or key.lower() in name_lower:
            return ab

    # Try matching first word
    first_word = name_lower.split()[0] if name_lower.split() else ""
    if first_word:
        for key, ab in antibiotic_map.items():
            if key.lower().startswith(first_word):
                return ab

    return None


# ─── Entry point ──────────────────────────────────────────────────


def main() -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL_SYNC)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as session:
        stats = migrate(session)

    print("\n=== Migration Complete ===")
    for key, val in stats.items():
        print(f"  {key}: {val}")


if __name__ == "__main__":
    main()
