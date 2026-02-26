from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.antibiotic import (
    Antibiotic,
    AntibioticCoverage,
    AntibioticPenetration,
    CrclRange,
    DialysisDosage,
    DosageRegimen,
    DosageValue,
    Pathogen,
    PenetrationSite,
)
from app.models.enums import AntibioticCategory, AgentType
from app.schemas.antibiotic import (
    AntibioticCreate,
    AntibioticDetail,
    AntibioticListItem,
    AntibioticSearchResult,
    AntibioticUpdate,
    CoverageRead,
    DialysisDosageRead,
    DosageForCrclResponse,
    DosageValueRead,
    NoteRead,
    PenetrationRead,
    RegimenRead,
)

router = APIRouter(prefix="/api/antibiotics", tags=["antibiotics"])


# ─── List all antibiotics ────────────────────────────────────────


@router.get("", response_model=list[AntibioticListItem])
async def list_antibiotics(
    category: str | None = None,
    agent_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Antibiotic).order_by(Antibiotic.id)
    if category:
        stmt = stmt.where(Antibiotic.category == AntibioticCategory(category))
    if agent_type:
        stmt = stmt.where(Antibiotic.agent_type == AgentType(agent_type))
    result = await db.execute(stmt)
    return result.scalars().all()


# ─── Get antibiotic detail ───────────────────────────────────────


@router.get("/{antibiotic_id}", response_model=AntibioticDetail)
async def get_antibiotic(antibiotic_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Antibiotic)
        .where(Antibiotic.id == antibiotic_id)
        .options(
            selectinload(Antibiotic.coverages).selectinload(AntibioticCoverage.pathogen),
            selectinload(Antibiotic.penetrations).selectinload(AntibioticPenetration.site),
            selectinload(Antibiotic.regimens).selectinload(DosageRegimen.dosage_values).selectinload(DosageValue.crcl_range),
            selectinload(Antibiotic.regimens).selectinload(DosageRegimen.dialysis_dosages),
            selectinload(Antibiotic.notes),
        )
    )
    result = await db.execute(stmt)
    ab = result.scalar_one_or_none()
    if not ab:
        raise HTTPException(status_code=404, detail="Antibiotic not found")

    return _build_detail(ab)


def _build_detail(ab: Antibiotic) -> AntibioticDetail:
    return AntibioticDetail(
        id=ab.id,
        name=ab.name,
        generic_name=ab.generic_name,
        category=ab.category.value,
        agent_type=ab.agent_type.value,
        generation=ab.generation,
        notes_for_doctor=ab.notes_for_doctor,
        notes_for_nurse=ab.notes_for_nurse,
        coverages=[
            CoverageRead(
                pathogen_code=c.pathogen.code,
                pathogen_name=c.pathogen.name,
                is_covered=c.is_covered,
            )
            for c in ab.coverages
        ],
        penetrations=[
            PenetrationRead(site_code=p.site.code, site_name=p.site.name)
            for p in ab.penetrations
        ],
        regimens=[
            RegimenRead(
                id=r.id,
                route=r.route.value,
                indication=r.indication,
                dose_descriptor=r.dose_descriptor,
                is_weight_based=r.is_weight_based,
                weight_type=r.weight_type.value if r.weight_type else None,
                is_preferred=r.is_preferred,
                fixed_duration=r.fixed_duration,
                preparation_instructions=r.preparation_instructions,
                notes_for_doctor=r.notes_for_doctor,
                notes_for_nurse=r.notes_for_nurse,
                sort_order=r.sort_order,
                dosage_values=[
                    DosageValueRead(
                        crcl_range_label=dv.crcl_range.label,
                        dose_text=dv.dose_text,
                        dose_amount=float(dv.dose_amount) if dv.dose_amount else None,
                        dose_unit=dv.dose_unit,
                        frequency=dv.frequency,
                    )
                    for dv in r.dosage_values
                ],
                dialysis_dosages=[
                    DialysisDosageRead(
                        dialysis_type=dd.dialysis_type.value,
                        dose_text=dd.dose_text,
                        notes=dd.notes,
                    )
                    for dd in r.dialysis_dosages
                ],
            )
            for r in sorted(ab.regimens, key=lambda x: x.sort_order)
        ],
        notes=[
            NoteRead(id=n.id, note_type=n.note_type, content=n.content)
            for n in ab.notes
        ],
    )


# ─── Search by pathogen coverage ─────────────────────────────────


@router.get("/search/by-coverage", response_model=list[AntibioticSearchResult])
async def search_by_coverage(
    pathogens: list[str] = Query(default=[], description="Pathogen codes to require coverage for"),
    db: AsyncSession = Depends(get_db),
):
    """Find antibiotics that cover ALL specified pathogens.
    Replaces the filterAntibiotics() function from script.js.
    """
    if not pathogens:
        # Return all antibiotics with their coverage summary
        return await _all_with_coverage(db)

    # Find pathogen IDs
    pathogen_result = await db.execute(
        select(Pathogen).where(Pathogen.code.in_(pathogens))
    )
    pathogen_objs = pathogen_result.scalars().all()
    if len(pathogen_objs) != len(pathogens):
        found = {p.code for p in pathogen_objs}
        missing = set(pathogens) - found
        raise HTTPException(status_code=400, detail=f"Unknown pathogen codes: {missing}")

    pathogen_ids = [p.id for p in pathogen_objs]

    # Find antibiotics that cover ALL specified pathogens
    stmt = (
        select(Antibiotic.id)
        .join(AntibioticCoverage)
        .where(
            AntibioticCoverage.pathogen_id.in_(pathogen_ids),
            AntibioticCoverage.is_covered.is_(True),
        )
        .group_by(Antibiotic.id)
        .having(func.count(func.distinct(AntibioticCoverage.pathogen_id)) == len(pathogen_ids))
    )
    result = await db.execute(stmt)
    matching_ids = [row[0] for row in result.all()]

    if not matching_ids:
        return []

    # Fetch full details for matching antibiotics
    stmt = (
        select(Antibiotic)
        .where(Antibiotic.id.in_(matching_ids))
        .options(
            selectinload(Antibiotic.coverages).selectinload(AntibioticCoverage.pathogen),
            selectinload(Antibiotic.penetrations).selectinload(AntibioticPenetration.site),
        )
        .order_by(Antibiotic.id)
    )
    result = await db.execute(stmt)
    antibiotics = result.scalars().all()

    return [
        AntibioticSearchResult(
            id=ab.id,
            name=ab.name,
            generic_name=ab.generic_name,
            category=ab.category.value,
            agent_type=ab.agent_type.value,
            generation=ab.generation,
            covered_pathogens=[c.pathogen.code for c in ab.coverages if c.is_covered],
            penetration_sites=[p.site.code for p in ab.penetrations],
        )
        for ab in antibiotics
    ]


async def _all_with_coverage(db: AsyncSession) -> list[AntibioticSearchResult]:
    stmt = (
        select(Antibiotic)
        .options(
            selectinload(Antibiotic.coverages).selectinload(AntibioticCoverage.pathogen),
            selectinload(Antibiotic.penetrations).selectinload(AntibioticPenetration.site),
        )
        .order_by(Antibiotic.id)
    )
    result = await db.execute(stmt)
    antibiotics = result.scalars().all()
    return [
        AntibioticSearchResult(
            id=ab.id,
            name=ab.name,
            generic_name=ab.generic_name,
            category=ab.category.value,
            agent_type=ab.agent_type.value,
            generation=ab.generation,
            covered_pathogens=[c.pathogen.code for c in ab.coverages if c.is_covered],
            penetration_sites=[p.site.code for p in ab.penetrations],
        )
        for ab in antibiotics
    ]


# ─── Dosage for CrCl ─────────────────────────────────────────────


@router.get("/{antibiotic_id}/dosage", response_model=DosageForCrclResponse)
async def get_dosage_for_crcl(
    antibiotic_id: int,
    crcl: float | None = Query(default=None, description="CrCl value in ml/min"),
    dialysis: str | None = Query(default=None, description="Dialysis type: HD, PD, or CRRT"),
    db: AsyncSession = Depends(get_db),
):
    """Get dosage recommendations for a specific CrCl value or dialysis mode."""
    ab = await db.get(Antibiotic, antibiotic_id)
    if not ab:
        raise HTTPException(status_code=404, detail="Antibiotic not found")

    # Load regimens with dosage values and dialysis dosages
    stmt = (
        select(DosageRegimen)
        .where(DosageRegimen.antibiotic_id == antibiotic_id)
        .options(
            selectinload(DosageRegimen.dosage_values).selectinload(DosageValue.crcl_range),
            selectinload(DosageRegimen.dialysis_dosages),
        )
        .order_by(DosageRegimen.sort_order)
    )
    result = await db.execute(stmt)
    regimens = result.scalars().all()

    if dialysis:
        # Return dialysis-specific dosages
        dial_dosages = []
        for r in regimens:
            for dd in r.dialysis_dosages:
                if dd.dialysis_type.value == dialysis:
                    dial_dosages.append(DialysisDosageRead(
                        dialysis_type=dd.dialysis_type.value,
                        dose_text=dd.dose_text,
                        notes=dd.notes,
                    ))

        return DosageForCrclResponse(
            antibiotic_name=ab.name,
            crcl_value=None,
            crcl_range_label=dialysis,
            is_dialysis=True,
            regimens=[],
            dialysis_dosages=dial_dosages,
        )

    # Determine CrCl range
    crcl_range = await _resolve_crcl_range(db, crcl)

    # Filter dosage values for matching CrCl range
    filtered_regimens = []
    for r in regimens:
        matching_values = [
            DosageValueRead(
                crcl_range_label=dv.crcl_range.label,
                dose_text=dv.dose_text,
                dose_amount=float(dv.dose_amount) if dv.dose_amount else None,
                dose_unit=dv.dose_unit,
                frequency=dv.frequency,
            )
            for dv in r.dosage_values
            if dv.crcl_range_id == crcl_range.id
        ]
        if matching_values:
            filtered_regimens.append(RegimenRead(
                id=r.id,
                route=r.route.value,
                indication=r.indication,
                dose_descriptor=r.dose_descriptor,
                is_weight_based=r.is_weight_based,
                weight_type=r.weight_type.value if r.weight_type else None,
                is_preferred=r.is_preferred,
                fixed_duration=r.fixed_duration,
                preparation_instructions=r.preparation_instructions,
                notes_for_doctor=r.notes_for_doctor,
                notes_for_nurse=r.notes_for_nurse,
                sort_order=r.sort_order,
                dosage_values=matching_values,
                dialysis_dosages=[],
            ))

    return DosageForCrclResponse(
        antibiotic_name=ab.name,
        crcl_value=crcl,
        crcl_range_label=crcl_range.label,
        is_dialysis=False,
        regimens=filtered_regimens,
        dialysis_dosages=[],
    )


async def _resolve_crcl_range(db: AsyncSession, crcl: float | None) -> CrclRange:
    """Find the CrCl range for a given value. Boundary rule: value takes the higher range."""
    if crcl is None or crcl > 90:
        # Normal renal function
        result = await db.execute(
            select(CrclRange).where(CrclRange.label == "Normal")
        )
        return result.scalar_one()

    # Find matching range: CrCl value takes the higher range at boundaries
    # e.g., CrCl=50 → "50~60" range (upper_bound-based matching)
    result = await db.execute(
        select(CrclRange)
        .where(
            CrclRange.lower_bound.isnot(None),
            CrclRange.lower_bound <= Decimal(str(crcl)),
        )
        .order_by(CrclRange.sort_order.desc())
    )
    ranges = result.scalars().all()

    for r in ranges:
        if r.upper_bound is not None and crcl <= float(r.upper_bound):
            return r
        if r.upper_bound is None:
            return r

    # Fallback: <5 range
    result = await db.execute(
        select(CrclRange).where(CrclRange.label == "<5")
    )
    return result.scalar_one()


# ─── Create antibiotic ───────────────────────────────────────────


@router.post("", response_model=AntibioticListItem, status_code=201)
async def create_antibiotic(
    data: AntibioticCreate,
    db: AsyncSession = Depends(get_db),
):
    ab = Antibiotic(
        name=data.name,
        generic_name=data.generic_name,
        category=AntibioticCategory(data.category),
        agent_type=AgentType(data.agent_type),
        generation=data.generation,
        notes_for_doctor=data.notes_for_doctor,
        notes_for_nurse=data.notes_for_nurse,
    )
    db.add(ab)
    await db.commit()
    await db.refresh(ab)
    return ab


# ─── Update antibiotic ──────────────────────────────────────────


@router.put("/{antibiotic_id}", response_model=AntibioticListItem)
async def update_antibiotic(
    antibiotic_id: int,
    data: AntibioticUpdate,
    db: AsyncSession = Depends(get_db),
):
    ab = await db.get(Antibiotic, antibiotic_id)
    if not ab:
        raise HTTPException(status_code=404, detail="Antibiotic not found")

    update_data = data.model_dump(exclude_unset=True)
    if "category" in update_data:
        update_data["category"] = AntibioticCategory(update_data["category"])
    if "agent_type" in update_data:
        update_data["agent_type"] = AgentType(update_data["agent_type"])

    for key, value in update_data.items():
        setattr(ab, key, value)

    await db.commit()
    await db.refresh(ab)
    return ab


# ─── Delete antibiotic ──────────────────────────────────────────


@router.delete("/{antibiotic_id}", status_code=204)
async def delete_antibiotic(
    antibiotic_id: int,
    db: AsyncSession = Depends(get_db),
):
    ab = await db.get(Antibiotic, antibiotic_id)
    if not ab:
        raise HTTPException(status_code=404, detail="Antibiotic not found")

    await db.delete(ab)
    await db.commit()
