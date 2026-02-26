from pydantic import BaseModel


# ─── Nested read schemas ──────────────────────────────────────────


class CoverageRead(BaseModel):
    pathogen_code: str
    pathogen_name: str
    is_covered: bool

    model_config = {"from_attributes": True}


class PenetrationRead(BaseModel):
    site_code: str
    site_name: str

    model_config = {"from_attributes": True}


class DosageValueRead(BaseModel):
    crcl_range_label: str
    dose_text: str
    dose_amount: float | None = None
    dose_unit: str | None = None
    frequency: str | None = None

    model_config = {"from_attributes": True}


class DialysisDosageRead(BaseModel):
    dialysis_type: str
    dose_text: str
    notes: str | None = None

    model_config = {"from_attributes": True}


class RegimenRead(BaseModel):
    id: int
    route: str
    indication: str | None = None
    dose_descriptor: str | None = None
    is_weight_based: bool = False
    weight_type: str | None = None
    is_preferred: bool = False
    fixed_duration: str | None = None
    preparation_instructions: str | None = None
    notes_for_doctor: str | None = None
    notes_for_nurse: str | None = None
    sort_order: int = 0
    dosage_values: list[DosageValueRead] = []
    dialysis_dosages: list[DialysisDosageRead] = []

    model_config = {"from_attributes": True}


class NoteRead(BaseModel):
    id: int
    note_type: str
    content: str

    model_config = {"from_attributes": True}


# ─── Antibiotic read schemas ─────────────────────────────────────


class AntibioticListItem(BaseModel):
    id: int
    name: str
    generic_name: str | None = None
    category: str
    agent_type: str
    generation: str | None = None

    model_config = {"from_attributes": True}


class AntibioticDetail(AntibioticListItem):
    notes_for_doctor: str | None = None
    notes_for_nurse: str | None = None
    coverages: list[CoverageRead] = []
    penetrations: list[PenetrationRead] = []
    regimens: list[RegimenRead] = []
    notes: list[NoteRead] = []


# ─── Antibiotic write schemas ────────────────────────────────────


class AntibioticCreate(BaseModel):
    name: str
    generic_name: str | None = None
    category: str
    agent_type: str = "antibacterial"
    generation: str | None = None
    notes_for_doctor: str | None = None
    notes_for_nurse: str | None = None


class AntibioticUpdate(BaseModel):
    name: str | None = None
    generic_name: str | None = None
    category: str | None = None
    agent_type: str | None = None
    generation: str | None = None
    notes_for_doctor: str | None = None
    notes_for_nurse: str | None = None


# ─── Search / query schemas ──────────────────────────────────────


class AntibioticSearchResult(AntibioticListItem):
    """Antibiotic with coverage summary for search results."""
    covered_pathogens: list[str] = []
    penetration_sites: list[str] = []


class DosageForCrclResponse(BaseModel):
    """Dosage recommendation for a specific CrCl value."""
    antibiotic_name: str
    crcl_value: float | None = None
    crcl_range_label: str
    is_dialysis: bool = False
    regimens: list[RegimenRead] = []
    dialysis_dosages: list[DialysisDosageRead] = []
