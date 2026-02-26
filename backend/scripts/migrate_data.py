"""Migrate data from data.js into normalized database tables.

Parses the JavaScript ANTIBIOTICS array and EMPIRIC_RULES array,
then inserts into all normalized tables.

Run with: python -m scripts.migrate_data
"""

import json
import re
from pathlib import Path

from sqlalchemy import select
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
from app.models.enums import (
    AgentType,
    AntibioticCategory,
    DialysisType,
    EmpiricTier,
    Route,
)

DATA_JS_PATH = Path(__file__).resolve().parent.parent.parent / "data.js"


# ─── JS Parsing ───────────────────────────────────────────────────


def parse_data_js(path: Path) -> tuple[list[dict], list[dict]]:
    """Parse data.js and extract ANTIBIOTICS and EMPIRIC_RULES arrays."""
    text = path.read_text(encoding="utf-8")

    antibiotics = _extract_js_array(text, "ANTIBIOTICS")
    empiric_rules = _extract_js_array(text, "EMPIRIC_RULES")

    return antibiotics, empiric_rules


def _extract_js_array(text: str, var_name: str) -> list[dict]:
    """Extract a JS array variable and convert to Python list of dicts."""
    pattern = rf"const\s+{var_name}\s*=\s*\["
    match = re.search(pattern, text)
    if not match:
        return []

    start = match.start()
    # Find the matching closing bracket
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

    # Convert JS object syntax to valid JSON
    json_str = _js_to_json(js_array)

    return json.loads(json_str)


def _js_to_json(js: str) -> str:
    """Convert JavaScript object/array literal to valid JSON."""
    s = js

    # Remove single-line comments
    s = re.sub(r"//[^\n]*", "", s)

    # Replace unquoted keys: word: → "word":
    s = re.sub(r"(?<=[{,\n])\s*(\w+)\s*:", r' "\1":', s)

    # Replace single quotes with double quotes (for string values)
    s = re.sub(r"'([^']*)'", r'"\1"', s)

    # Handle boolean values (JS true/false are same as JSON)
    # Handle trailing commas before ] or }
    s = re.sub(r",\s*([}\]])", r"\1", s)

    return s


# ─── Category Detection ───────────────────────────────────────────

# Map drug names/patterns to categories
_CATEGORY_RULES: list[tuple[str, AntibioticCategory]] = [
    # Penicillins
    ("Oxacillin", AntibioticCategory.penicillin),
    ("Ampicillin", AntibioticCategory.penicillin),
    ("Unasyn", AntibioticCategory.penicillin),
    ("Tazocin", AntibioticCategory.penicillin),
    ("Amox-Clav", AntibioticCategory.penicillin),
    ("Augmentin", AntibioticCategory.penicillin),
    # Cephalosporins
    ("Cef", AntibioticCategory.cephalosporin),
    ("Flomoxef", AntibioticCategory.cephalosporin),
    ("Brosym", AntibioticCategory.cephalosporin),
    ("Zavicefta", AntibioticCategory.cephalosporin),
    # Carbapenems
    ("Ertapenem", AntibioticCategory.carbapenem),
    ("Meropenem", AntibioticCategory.carbapenem),
    ("Culin", AntibioticCategory.carbapenem),
    ("Imipenem", AntibioticCategory.carbapenem),
    ("Doripenem", AntibioticCategory.carbapenem),
    # Fluoroquinolones
    ("Ciprofloxacin", AntibioticCategory.fluoroquinolone),
    ("Levofloxacin", AntibioticCategory.fluoroquinolone),
    ("Moxifloxacin", AntibioticCategory.fluoroquinolone),
    ("Nemonoxacin", AntibioticCategory.fluoroquinolone),
    # Glycopeptides
    ("Teicoplanin", AntibioticCategory.glycopeptide),
    ("Vancomycin", AntibioticCategory.glycopeptide),
    # Oxazolidinone
    ("Linezolid", AntibioticCategory.oxazolidinone),
    # Tetracyclines
    ("Minocycline", AntibioticCategory.tetracycline),
    ("Tigecycline", AntibioticCategory.tetracycline),
    # Macrolides
    ("Erythromycin", AntibioticCategory.macrolide),
    ("Azithromycin", AntibioticCategory.macrolide),
    # Lincosamide
    ("Clindamycin", AntibioticCategory.lincosamide),
    # Polymyxins
    ("Colistin", AntibioticCategory.polymyxin),
    ("polymyxin", AntibioticCategory.polymyxin),
    ("Bobimixyn", AntibioticCategory.polymyxin),
    # Aminoglycosides
    ("Amikacin", AntibioticCategory.aminoglycoside),
    # Other antibacterials
    ("Baktar", AntibioticCategory.other),
    ("TMP/SMX", AntibioticCategory.other),
    ("Metronidazole", AntibioticCategory.other),
    ("Daptomycin", AntibioticCategory.other),
    ("Rifampin", AntibioticCategory.other),
    ("Fosfomycin", AntibioticCategory.other),
    # Antifungals
    ("Fluconazole", AntibioticCategory.other),
    ("Voriconazole", AntibioticCategory.other),
    ("Flucytosine", AntibioticCategory.other),
    ("Anidulafungin", AntibioticCategory.other),
    ("ERAXIS", AntibioticCategory.other),
    ("Isavuconazole", AntibioticCategory.other),
    ("Amphotericin", AntibioticCategory.other),
    # Antivirals
    ("Acyclovir", AntibioticCategory.other),
    ("Ganciclovir", AntibioticCategory.other),
    ("Peramivir", AntibioticCategory.other),
]

# Antifungal names
_ANTIFUNGALS = {
    "Fluconazole", "Voriconazole", "Flucytosine", "Anidulafungin",
    "ERAXIS", "Isavuconazole", "Amphotericin",
}

# Antiviral names
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
    """Extract generation from name like 'Cefepime (4°)'."""
    m = re.search(r"\((\d)°\)", name)
    return f"{m.group(1)}°" if m else None


# ─── Route Parsing ────────────────────────────────────────────────


def parse_route(indication: str) -> Route:
    """Extract route from indication text like 'IV (General)' or 'PO/IV (CAP)'."""
    ind_upper = indication.upper()
    if "IV/PO" in ind_upper or "PO/IV" in ind_upper:
        return Route.IV_PO
    if "IV/IM" in ind_upper or "IM/IV" in ind_upper:
        return Route.IV_IM
    if "INHL" in ind_upper:
        return Route.INHL
    if "IV" in ind_upper:
        return Route.IV
    if "PO" in ind_upper:
        return Route.PO
    if "IM" in ind_upper:
        return Route.IM
    # Default: try to guess from dose text
    return Route.IV


def parse_indication(indication: str) -> str:
    """Strip route prefix from indication, e.g. 'IV (General)' → 'General'."""
    # Remove route prefixes
    cleaned = re.sub(r"^(IV/PO|PO/IV|IV/IM|IV|PO|IM|INHL)\s*", "", indication)
    # Remove surrounding parentheses
    cleaned = cleaned.strip()
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = cleaned[1:-1]
    return cleaned.strip() or "standard"


# ─── Main Migration ───────────────────────────────────────────────


def migrate(session: Session) -> dict:
    """Run the full migration. Returns stats dict."""
    stats = {}

    # Load lookup tables
    pathogens = {p.code: p for p in session.execute(select(Pathogen)).scalars().all()}
    sites = {
        s.code: s for s in session.execute(select(PenetrationSite)).scalars().all()
    }
    crcl_normal = (
        session.execute(select(CrclRange).where(CrclRange.label == "Normal"))
        .scalar_one_or_none()
    )

    if not pathogens:
        raise RuntimeError("Pathogens table is empty. Run seed_data first.")
    if not crcl_normal:
        raise RuntimeError("CrCl ranges table is empty. Run seed_data first.")

    # Parse data.js
    antibiotics_data, empiric_data = parse_data_js(DATA_JS_PATH)
    print(f"Parsed {len(antibiotics_data)} antibiotics, {len(empiric_data)} empiric rules from data.js")

    # --- Migrate antibiotics ---
    antibiotic_map: dict[str, Antibiotic] = {}  # name → model

    for i, ab_data in enumerate(antibiotics_data):
        name = ab_data["name"]
        ab = Antibiotic(
            name=name,
            generic_name=None,
            category=detect_category(name).value,
            agent_type=detect_agent_type(name).value,
            generation=detect_generation(name),
        )
        session.add(ab)
        session.flush()  # get ab.id
        antibiotic_map[name] = ab

        # --- Coverage ---
        coverage_count = 0
        for field in ("coverage", "resistance"):
            cov_data = ab_data.get(field, {})
            for code, value in cov_data.items():
                # Normalize code: some data.js keys differ from DB codes
                db_code = _normalize_pathogen_code(code)
                pathogen = pathogens.get(db_code)
                if pathogen is None:
                    print(f"  WARNING: Unknown pathogen code '{code}' (normalized: '{db_code}') for {name}")
                    continue
                is_covered = bool(value and value.strip())
                session.add(AntibioticCoverage(
                    antibiotic_id=ab.id,
                    pathogen_id=pathogen.id,
                    is_covered=is_covered,
                ))
                if is_covered:
                    coverage_count += 1

        # --- Penetration ---
        pen_data = ab_data.get("penetration", {})
        for code, value in pen_data.items():
            db_code = _normalize_site_code(code)
            site = sites.get(db_code)
            if site is None:
                # Some sites in data.js (Bili, UTI) aren't in our initial sites
                # We'll skip non-matching ones silently
                continue
            if value:
                session.add(AntibioticPenetration(
                    antibiotic_id=ab.id,
                    site_id=site.id,
                ))

        # --- Dosage regimens ---
        for j, dos_data in enumerate(ab_data.get("dosages", [])):
            indication_raw = dos_data.get("indication", "standard")
            route = parse_route(indication_raw)
            indication = parse_indication(indication_raw)
            dose_text = dos_data.get("dose", "")
            is_preferred = dos_data.get("preferred", False)

            regimen = DosageRegimen(
                antibiotic_id=ab.id,
                route=route.value,
                indication=indication,
                is_preferred=is_preferred,
                sort_order=j,
            )
            session.add(regimen)
            session.flush()

            # Create a dosage_value for Normal CrCl
            session.add(DosageValue(
                regimen_id=regimen.id,
                crcl_range_id=crcl_normal.id,
                dose_text=dose_text,
            ))

            # --- Dialysis dosages for this regimen ---
            if j == 0:  # Only attach dialysis to the primary/first regimen
                dial_data = ab_data.get("dialysisDosages", {})
                for dtype_str, dial_text in dial_data.items():
                    try:
                        dtype = DialysisType(dtype_str)
                    except ValueError:
                        print(f"  WARNING: Unknown dialysis type '{dtype_str}' for {name}")
                        continue
                    session.add(DialysisDosage(
                        regimen_id=regimen.id,
                        dialysis_type=dtype.value,
                        dose_text=dial_text,
                    ))

        # --- Comments → antibiotic_notes ---
        comments = ab_data.get("comments", "").strip()
        if comments:
            session.add(AntibioticNote(
                antibiotic_id=ab.id,
                note_type="general",
                content=comments,
            ))

    stats["antibiotics"] = len(antibiotic_map)
    stats["coverage_records"] = session.execute(
        select(AntibioticCoverage)
    ).scalars().all().__len__()
    stats["dosage_regimens"] = session.execute(
        select(DosageRegimen)
    ).scalars().all().__len__()

    # --- Migrate empiric rules ---
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
                # Handle combination entries like "Ceftriaxone (3°) + Metronidazole"
                # Store as-is, link to first antibiotic if found
                ab_name_clean = ab_name_raw.split(" + ")[0].strip()
                ab = antibiotic_map.get(ab_name_clean)
                if ab is None:
                    # Try fuzzy match
                    for key in antibiotic_map:
                        if ab_name_clean.lower() in key.lower():
                            ab = antibiotic_map[key]
                            break
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


def _normalize_pathogen_code(code: str) -> str:
    """Map data.js pathogen keys to DB pathogen codes."""
    mapping = {
        "Efc": "Efc",
        "Efm": "Efm",
        "Enbac": "Enbac",
        "Bili": "Bili",   # This is actually not a pathogen, skip
        "Atyp": "Atyp",
        "Ab": "Ab",
    }
    return mapping.get(code, code)


def _normalize_site_code(code: str) -> str:
    """Map data.js penetration keys to DB site codes."""
    return code  # Direct mapping: BBB, Pros, Endo


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
