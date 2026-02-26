from pydantic import BaseModel


class PathogenRead(BaseModel):
    id: int
    code: str
    name: str
    pathogen_type: str
    sort_order: int

    model_config = {"from_attributes": True}


class PenetrationSiteRead(BaseModel):
    id: int
    code: str
    name: str
    sort_order: int

    model_config = {"from_attributes": True}


class CrclRangeRead(BaseModel):
    id: int
    label: str
    lower_bound: float | None
    upper_bound: float | None
    sort_order: int

    model_config = {"from_attributes": True}
