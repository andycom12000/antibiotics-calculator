from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.antibiotics import router as antibiotics_router
from app.api.empiric import router as empiric_router
from app.api.institutions import router as institutions_router
from app.api.lookups import router as lookups_router
from app.core.config import settings

app = FastAPI(title=settings.APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(antibiotics_router)
app.include_router(lookups_router)
app.include_router(empiric_router)
app.include_router(institutions_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
