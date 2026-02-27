"""Convert raw spreadsheet data (array-of-arrays) to structured drug JSON.

Reads spreadsheet_raw.json (85 rows × 58 cols from Google Sheets 資料區)
and outputs spreadsheet_data.json (structured drug objects).

Run with: python -m scripts.convert_spreadsheet
"""

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_PATH = SCRIPT_DIR / "spreadsheet_raw.json"
OUT_PATH = SCRIPT_DIR / "spreadsheet_data.json"

# ─── Column indices (0-based) ────────────────────────────────────

COL_DRUG_NAME = 1
COL_COVERAGE_START = 3   # Strep
COL_COVERAGE_END = 19    # CRKP (inclusive)
COL_PEN_BBB = 20
COL_PEN_PROS = 21
COL_PEN_ENDO = 22
COL_CATEGORY = 24
COL_ROUTE = 25
COL_REF_NAME = 26
COL_CRCL_START = 27      # <5
COL_CRCL_END = 38        # Normal (inclusive)
COL_HD = 39
COL_CRRT = 40
COL_OTHER = 41
COL_TOX_START = 43       # General
COL_TOX_END = 53         # Endocrine (inclusive)

# Coverage column index → pathogen code
COVERAGE_MAP = {
    3: "Strep",
    4: "MSSA",
    5: "Efc",
    6: "Efm",
    # 7: GNB — no data in spreadsheet
    # 8: Enbac — no data in spreadsheet
    9: "PsA",
    # 10: Ab — no data in spreadsheet
    11: "Anae",
    12: "Atyp",
    13: "Steno",
    14: "Glabrata",
    15: "MRSA",
    16: "ESBL",
    17: "VRE",
    18: "MDRAB",
    19: "CRKP",
}

# CrCl range labels in order (col 27-38)
CRCL_LABELS = [
    "<5", "5~10", "10~15", "15~20", "20~25", "25~30",
    "30~40", "40~50", "50~60", "60~80", "80~90", "Normal",
]

# Toxicity column index → category key
TOXICITY_MAP = {
    43: "general",
    44: "renal",
    45: "hepatic",
    46: "cardiac",
    47: "neurologic",
    48: "musculoskeletal",
    49: "gi",
    50: "skin",
    51: "obgyn",
    52: "hematologic",
    53: "endocrine",
}



def _cell(row: list, idx: int) -> str | None:
    """Get cell value, returning None for empty/FALSE values."""
    if idx >= len(row):
        return None
    v = row[idx]
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return None  # numeric side-data, not relevant
    v = str(v).strip()
    if v == "" or v == "FALSE":
        return None
    return v


def _coverage_value(row: list, col: int) -> str | None:
    """Extract coverage value (v, +, ++)."""
    v = _cell(row, col)
    if v in ("v", "+", "++"):
        return v
    if v == "TRUE":
        return "v"
    return None


def detect_generation(name: str) -> str | None:
    """Extract generation from name like 'Cefepime (4°)'."""
    m = re.search(r"\((\d)\s*°\s*\)", name)
    return f"{m.group(1)}°" if m else None


def parse_route(route_raw: str) -> tuple[str, str | None]:
    """Parse route string into (route_enum, indication).

    Returns (route, indication) where route is one of:
    IV, PO, INHL, IV/PO, IV/IM, IM
    """
    if route_raw is None:
        return ("IV", None)

    s = route_raw.strip()

    # Special case: "Stenotrophomonas m." is an indication, not a route
    if s.startswith("Stenotrophomonas"):
        return ("IV_PO", "Stenotrophomonas m.")

    # Extract route prefix and indication
    route_patterns = [
        (r"^IV/PO\b", "IV/PO"),
        (r"^PO/IV\b", "IV/PO"),
        (r"^IV/IM\b", "IV/IM"),
        (r"^INHL\b", "INHL"),
        (r"^IV\b", "IV"),
        (r"^PO\b", "PO"),
        (r"^IM\b", "IM"),
    ]

    route = "IV"  # default
    indication = None

    for pattern, route_val in route_patterns:
        m = re.match(pattern, s, re.IGNORECASE)
        if m:
            route = route_val
            rest = s[m.end():].strip()
            # Remove surrounding parentheses
            if rest.startswith("(") and rest.endswith(")"):
                rest = rest[1:-1].strip()
            elif rest.startswith("("):
                # Handle cases like "PO(XR)(Cystitis)"
                rest = rest[1:].rstrip(")").strip()
            indication = rest if rest else None
            break
    else:
        # No route prefix matched — entire string is the route
        indication = None

    return (route, indication)


def is_duplicate_row(new_row: list, existing_rows: list[list]) -> bool:
    """Check if a row is a duplicate of an existing row (same route AND doses)."""
    new_route = _cell(new_row, COL_ROUTE)
    new_doses = [_cell(new_row, c) for c in range(COL_CRCL_START, COL_CRCL_END + 1)]

    for ex_row in existing_rows:
        ex_route = _cell(ex_row, COL_ROUTE)
        ex_doses = [_cell(ex_row, c) for c in range(COL_CRCL_START, COL_CRCL_END + 1)]

        if new_route == ex_route and new_doses == ex_doses:
            return True
    return False


def convert() -> dict:
    """Convert raw spreadsheet data to structured JSON."""
    raw = json.loads(RAW_PATH.read_text(encoding="utf-8"))

    # Row 0: credits, Row 1: headers, Rows 2+: data
    data_rows = raw[2:]

    # First pass: build cascading category map (row_idx → category string)
    # Category values in Col 24 only appear on the first drug of each section
    # and cascade down to all subsequent rows until the next category marker.
    row_category: dict[int, str | None] = {}
    current_cat = None
    for i, row in enumerate(data_rows):
        row_idx = i + 2
        explicit_cat = _cell(row, COL_CATEGORY)
        if explicit_cat:
            current_cat = explicit_cat
        row_category[row_idx] = current_cat

    # Group by Reference Name (col 26)
    groups: dict[str, list[int]] = {}  # ref_name → [row_indices into raw]
    for i, row in enumerate(data_rows):
        row_idx = i + 2  # offset for raw index
        ref = _cell(row, COL_REF_NAME)
        if ref is None:
            continue
        if ref not in groups:
            groups[ref] = []
        # Deduplicate: skip if identical route+doses already exist
        existing_rows = [raw[ri] for ri in groups[ref]]
        if not is_duplicate_row(row, existing_rows):
            groups[ref].append(row_idx)
        else:
            print(f"  DEDUP: Skipping row {row_idx} ({ref}, route={_cell(row, COL_ROUTE)}) — duplicate")

    drugs = []
    for ref_name, row_indices in groups.items():
        first_row = raw[row_indices[0]]

        # Drug name = Reference Name (col 26)
        name = ref_name

        # Category: use explicit value from any row, or cascading value
        # Store raw spreadsheet string — migrate_data.py will map to DB enums
        category_raw = None
        for ri in row_indices:
            cat = _cell(raw[ri], COL_CATEGORY)
            if cat:
                category_raw = cat
                break
        if category_raw is None:
            # Use cascading category from first row
            category_raw = row_category.get(row_indices[0])

        generation = detect_generation(name)

        # Coverage (from first row — all rows of same drug share coverage)
        # Also check subsequent rows in case the first row's coverage is sparse
        coverage = {}
        for col, code in COVERAGE_MAP.items():
            for ri in row_indices:
                val = _coverage_value(raw[ri], col)
                if val:
                    coverage[code] = val
                    break

        # Penetration (from first row)
        penetration = {}
        for col, site in [(COL_PEN_BBB, "BBB"), (COL_PEN_PROS, "Pros"), (COL_PEN_ENDO, "Endo")]:
            val = _cell(first_row, col)
            if val:
                penetration[site] = True

        # Regimens
        regimens = []
        for ri in row_indices:
            row = raw[ri]
            route_raw = _cell(row, COL_ROUTE)
            route, indication = parse_route(route_raw)

            # CrCl dosages
            dosages = {}
            for j, label in enumerate(CRCL_LABELS):
                dose = _cell(row, COL_CRCL_START + j)
                if dose:
                    dosages[label] = dose

            hd = _cell(row, COL_HD)
            crrt = _cell(row, COL_CRRT)

            regimens.append({
                "route": route,
                "indication": indication,
                "dosages": dosages if dosages else None,
                "hd": hd,
                "crrt": crrt,
            })

        # Notes (OTHER column — take first non-null across all rows)
        notes = None
        for ri in row_indices:
            n = _cell(raw[ri], COL_OTHER)
            if n:
                notes = n
                break

        # Toxicities (from first row that has any toxicity data)
        toxicities = {}
        for ri in row_indices:
            for col, tox_key in TOXICITY_MAP.items():
                val = _cell(raw[ri], col)
                if val and tox_key not in toxicities:
                    toxicities[tox_key] = val
            if toxicities:
                break

        drugs.append({
            "name": name,
            "category_raw": category_raw,
            "generation": generation,
            "coverage": coverage if coverage else None,
            "penetration": penetration if penetration else None,
            "regimens": regimens,
            "notes": notes,
            "toxicities": toxicities if toxicities else None,
        })

    result = {
        "source": "Google Sheets 資料區 (gid=1738940485)",
        "generated_note": "Auto-generated by convert_spreadsheet.py. Do not edit manually.",
        "drug_count": len(drugs),
        "regimen_count": sum(len(d["regimens"]) for d in drugs),
        "drugs": drugs,
    }

    OUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(drugs)} drugs, "
          f"{sum(len(d['regimens']) for d in drugs)} regimens "
          f"to {OUT_PATH}")
    return result


if __name__ == "__main__":
    convert()
