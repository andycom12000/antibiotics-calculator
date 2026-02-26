from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/antibiotic_calc"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/antibiotic_calc"
    APP_TITLE: str = "Antibiotic Calculator API"
    DEBUG: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
