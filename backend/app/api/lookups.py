from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.antibiotic import CrclRange, Pathogen, PenetrationSite
from app.schemas.common import CrclRangeRead, PathogenRead, PenetrationSiteRead

router = APIRouter(prefix="/api", tags=["lookups"])


@router.get("/pathogens", response_model=list[PathogenRead])
async def list_pathogens(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pathogen).order_by(Pathogen.sort_order))
    return result.scalars().all()


@router.get("/penetration-sites", response_model=list[PenetrationSiteRead])
async def list_penetration_sites(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PenetrationSite).order_by(PenetrationSite.sort_order)
    )
    return result.scalars().all()


@router.get("/crcl-ranges", response_model=list[CrclRangeRead])
async def list_crcl_ranges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CrclRange).order_by(CrclRange.sort_order))
    return result.scalars().all()
