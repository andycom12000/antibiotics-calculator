from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.antibiotic import (
    Antibiotic,
    EmpiricRecommendation,
    EmpiricSyndrome,
)
from app.models.enums import EmpiricTier
from app.schemas.empiric import (
    EmpiricRecommendationCreate,
    EmpiricRecommendationRead,
    EmpiricSyndromeCreate,
    EmpiricSyndromeRead,
)

router = APIRouter(prefix="/api/empiric", tags=["empiric"])


@router.get("", response_model=list[EmpiricSyndromeRead])
async def list_syndromes(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(EmpiricSyndrome)
        .options(
            selectinload(EmpiricSyndrome.recommendations)
            .selectinload(EmpiricRecommendation.antibiotic)
        )
        .order_by(EmpiricSyndrome.id)
    )
    result = await db.execute(stmt)
    syndromes = result.scalars().all()
    return [_build_syndrome(s) for s in syndromes]


@router.get("/{syndrome_id}", response_model=EmpiricSyndromeRead)
async def get_syndrome(syndrome_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(EmpiricSyndrome)
        .where(EmpiricSyndrome.id == syndrome_id)
        .options(
            selectinload(EmpiricSyndrome.recommendations)
            .selectinload(EmpiricRecommendation.antibiotic)
        )
    )
    result = await db.execute(stmt)
    syndrome = result.scalar_one_or_none()
    if not syndrome:
        raise HTTPException(status_code=404, detail="Syndrome not found")
    return _build_syndrome(syndrome)


@router.post("", response_model=EmpiricSyndromeRead, status_code=201)
async def create_syndrome(
    data: EmpiricSyndromeCreate,
    db: AsyncSession = Depends(get_db),
):
    syndrome = EmpiricSyndrome(name=data.name)
    db.add(syndrome)
    await db.commit()
    await db.refresh(syndrome)
    return EmpiricSyndromeRead(id=syndrome.id, name=syndrome.name, recommendations=[])


@router.post("/{syndrome_id}/recommendations", status_code=201)
async def add_recommendation(
    syndrome_id: int,
    data: EmpiricRecommendationCreate,
    db: AsyncSession = Depends(get_db),
):
    syndrome = await db.get(EmpiricSyndrome, syndrome_id)
    if not syndrome:
        raise HTTPException(status_code=404, detail="Syndrome not found")

    ab = await db.get(Antibiotic, data.antibiotic_id)
    if not ab:
        raise HTTPException(status_code=400, detail="Antibiotic not found")

    rec = EmpiricRecommendation(
        syndrome_id=syndrome_id,
        antibiotic_id=data.antibiotic_id,
        tier=EmpiricTier(data.tier),
        is_addon=data.is_addon,
        addon_notes=data.addon_notes,
    )
    db.add(rec)
    await db.commit()
    return {"status": "created"}


@router.delete("/{syndrome_id}", status_code=204)
async def delete_syndrome(syndrome_id: int, db: AsyncSession = Depends(get_db)):
    syndrome = await db.get(EmpiricSyndrome, syndrome_id)
    if not syndrome:
        raise HTTPException(status_code=404, detail="Syndrome not found")
    await db.delete(syndrome)
    await db.commit()


def _build_syndrome(s: EmpiricSyndrome) -> EmpiricSyndromeRead:
    return EmpiricSyndromeRead(
        id=s.id,
        name=s.name,
        recommendations=[
            EmpiricRecommendationRead(
                antibiotic_id=r.antibiotic_id,
                antibiotic_name=r.antibiotic.name,
                tier=r.tier.value,
                is_addon=r.is_addon,
                addon_notes=r.addon_notes,
            )
            for r in s.recommendations
        ],
    )
