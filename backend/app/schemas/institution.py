from pydantic import BaseModel


class CoverageOverrideRead(BaseModel):
    id: int
    antibiotic_id: int
    antibiotic_name: str
    pathogen_id: int
    pathogen_code: str
    is_covered: bool

    model_config = {"from_attributes": True}


class CoverageOverrideCreate(BaseModel):
    antibiotic_id: int
    pathogen_id: int
    is_covered: bool


class InstitutionRead(BaseModel):
    id: int
    name: str
    code: str
    override_count: int = 0

    model_config = {"from_attributes": True}


class InstitutionDetail(InstitutionRead):
    overrides: list[CoverageOverrideRead] = []


class InstitutionCreate(BaseModel):
    name: str
    code: str
