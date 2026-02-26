from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.antibiotic import (
    Antibiotic,
    CoverageOverride,
    Institution,
    Pathogen,
)
from app.schemas.institution import (
    CoverageOverrideCreate,
    CoverageOverrideRead,
    InstitutionCreate,
    InstitutionDetail,
    InstitutionRead,
)

router = APIRouter(prefix="/api/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionRead])
async def list_institutions(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            Institution,
            func.count(CoverageOverride.id).label("override_count"),
        )
        .outerjoin(CoverageOverride)
        .group_by(Institution.id)
        .order_by(Institution.id)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        InstitutionRead(
            id=inst.id, name=inst.name, code=inst.code, override_count=count
        )
        for inst, count in rows
    ]


@router.get("/{institution_id}", response_model=InstitutionDetail)
async def get_institution(institution_id: int, db: AsyncSession = Depends(get_db)):
    inst = await db.get(Institution, institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    stmt = (
        select(CoverageOverride)
        .where(CoverageOverride.institution_id == institution_id)
        .options(
            selectinload(CoverageOverride.institution),
        )
    )
    result = await db.execute(stmt)
    overrides = result.scalars().all()

    # Load antibiotic and pathogen names for each override
    override_reads = []
    for o in overrides:
        ab = await db.get(Antibiotic, o.antibiotic_id)
        pathogen = await db.get(Pathogen, o.pathogen_id)
        override_reads.append(CoverageOverrideRead(
            id=o.id,
            antibiotic_id=o.antibiotic_id,
            antibiotic_name=ab.name if ab else "Unknown",
            pathogen_id=o.pathogen_id,
            pathogen_code=pathogen.code if pathogen else "Unknown",
            is_covered=o.is_covered,
        ))

    return InstitutionDetail(
        id=inst.id,
        name=inst.name,
        code=inst.code,
        override_count=len(override_reads),
        overrides=override_reads,
    )


@router.post("", response_model=InstitutionRead, status_code=201)
async def create_institution(
    data: InstitutionCreate,
    db: AsyncSession = Depends(get_db),
):
    inst = Institution(name=data.name, code=data.code)
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return InstitutionRead(id=inst.id, name=inst.name, code=inst.code, override_count=0)


@router.delete("/{institution_id}", status_code=204)
async def delete_institution(
    institution_id: int,
    db: AsyncSession = Depends(get_db),
):
    inst = await db.get(Institution, institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    await db.delete(inst)
    await db.commit()


# ─── Coverage Overrides ──────────────────────────────────────────


@router.post("/{institution_id}/overrides", status_code=201)
async def create_override(
    institution_id: int,
    data: CoverageOverrideCreate,
    db: AsyncSession = Depends(get_db),
):
    inst = await db.get(Institution, institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    override = CoverageOverride(
        institution_id=institution_id,
        antibiotic_id=data.antibiotic_id,
        pathogen_id=data.pathogen_id,
        is_covered=data.is_covered,
    )
    db.add(override)
    await db.commit()
    return {"status": "created"}


@router.delete("/{institution_id}/overrides/{override_id}", status_code=204)
async def delete_override(
    institution_id: int,
    override_id: int,
    db: AsyncSession = Depends(get_db),
):
    override = await db.get(CoverageOverride, override_id)
    if not override or override.institution_id != institution_id:
        raise HTTPException(status_code=404, detail="Override not found")
    await db.delete(override)
    await db.commit()
