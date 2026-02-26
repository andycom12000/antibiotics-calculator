from pydantic import BaseModel


class EmpiricRecommendationRead(BaseModel):
    antibiotic_id: int
    antibiotic_name: str
    tier: str
    is_addon: bool = False
    addon_notes: str | None = None

    model_config = {"from_attributes": True}


class EmpiricSyndromeRead(BaseModel):
    id: int
    name: str
    recommendations: list[EmpiricRecommendationRead] = []

    model_config = {"from_attributes": True}


class EmpiricSyndromeCreate(BaseModel):
    name: str


class EmpiricRecommendationCreate(BaseModel):
    antibiotic_id: int
    tier: str
    is_addon: bool = False
    addon_notes: str | None = None
