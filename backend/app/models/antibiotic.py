from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import (
    AgentType,
    AntibioticCategory,
    DialysisType,
    EmpiricTier,
    PathogenType,
    Route,
    ToxicityCategory,
    WeightType,
)


# ─── 1. antibiotics ───────────────────────────────────────────────


class Antibiotic(TimestampMixin, Base):
    __tablename__ = "antibiotics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255))
    category: Mapped[AntibioticCategory] = mapped_column(
        Enum(AntibioticCategory, name="antibiotic_category")
    )
    agent_type: Mapped[AgentType] = mapped_column(
        Enum(AgentType, name="agent_type"), default=AgentType.antibacterial
    )
    generation: Mapped[Optional[str]] = mapped_column(String(10))
    notes_for_doctor: Mapped[Optional[str]] = mapped_column(Text)
    notes_for_nurse: Mapped[Optional[str]] = mapped_column(Text)

    # relationships
    coverages: Mapped[list["AntibioticCoverage"]] = relationship(
        back_populates="antibiotic", cascade="all, delete-orphan"
    )
    penetrations: Mapped[list["AntibioticPenetration"]] = relationship(
        back_populates="antibiotic", cascade="all, delete-orphan"
    )
    regimens: Mapped[list["DosageRegimen"]] = relationship(
        back_populates="antibiotic", cascade="all, delete-orphan"
    )
    toxicities: Mapped[list["Toxicity"]] = relationship(
        back_populates="antibiotic", cascade="all, delete-orphan"
    )
    empiric_recommendations: Mapped[list["EmpiricRecommendation"]] = relationship(
        back_populates="antibiotic"
    )
    notes: Mapped[list["AntibioticNote"]] = relationship(
        back_populates="antibiotic", cascade="all, delete-orphan"
    )


# ─── 2. pathogens ─────────────────────────────────────────────────


class Pathogen(Base):
    __tablename__ = "pathogens"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    pathogen_type: Mapped[PathogenType] = mapped_column(
        Enum(PathogenType, name="pathogen_type")
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    coverages: Mapped[list["AntibioticCoverage"]] = relationship(
        back_populates="pathogen"
    )


# ─── 3. penetration_sites ─────────────────────────────────────────


class PenetrationSite(Base):
    __tablename__ = "penetration_sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    penetrations: Mapped[list["AntibioticPenetration"]] = relationship(
        back_populates="site"
    )


# ─── 4. antibiotic_coverage (M2M) ─────────────────────────────────


class AntibioticCoverage(Base):
    __tablename__ = "antibiotic_coverage"
    __table_args__ = (
        UniqueConstraint("antibiotic_id", "pathogen_id", name="uq_coverage"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    pathogen_id: Mapped[int] = mapped_column(
        ForeignKey("pathogens.id", ondelete="CASCADE")
    )
    is_covered: Mapped[bool] = mapped_column(Boolean, default=False)

    antibiotic: Mapped["Antibiotic"] = relationship(back_populates="coverages")
    pathogen: Mapped["Pathogen"] = relationship(back_populates="coverages")


# ─── 5. antibiotic_penetration (M2M) ──────────────────────────────


class AntibioticPenetration(Base):
    __tablename__ = "antibiotic_penetration"
    __table_args__ = (
        UniqueConstraint("antibiotic_id", "site_id", name="uq_penetration"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    site_id: Mapped[int] = mapped_column(
        ForeignKey("penetration_sites.id", ondelete="CASCADE")
    )

    antibiotic: Mapped["Antibiotic"] = relationship(back_populates="penetrations")
    site: Mapped["PenetrationSite"] = relationship(back_populates="penetrations")


# ─── 6. crcl_ranges ───────────────────────────────────────────────


class CrclRange(Base):
    __tablename__ = "crcl_ranges"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(50), unique=True)
    lower_bound: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    upper_bound: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    dosage_values: Mapped[list["DosageValue"]] = relationship(
        back_populates="crcl_range"
    )


# ─── 7. dosage_regimens ───────────────────────────────────────────


class DosageRegimen(Base):
    __tablename__ = "dosage_regimens"

    id: Mapped[int] = mapped_column(primary_key=True)
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    route: Mapped[Route] = mapped_column(Enum(Route, name="route"))
    indication: Mapped[Optional[str]] = mapped_column(String(255))
    dose_descriptor: Mapped[Optional[str]] = mapped_column(String(255))
    is_weight_based: Mapped[bool] = mapped_column(Boolean, default=False)
    weight_type: Mapped[Optional[WeightType]] = mapped_column(
        Enum(WeightType, name="weight_type")
    )
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False)
    fixed_duration: Mapped[Optional[str]] = mapped_column(String(100))
    preparation_instructions: Mapped[Optional[str]] = mapped_column(Text)
    notes_for_doctor: Mapped[Optional[str]] = mapped_column(Text)
    notes_for_nurse: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    antibiotic: Mapped["Antibiotic"] = relationship(back_populates="regimens")
    dosage_values: Mapped[list["DosageValue"]] = relationship(
        back_populates="regimen", cascade="all, delete-orphan"
    )
    dialysis_dosages: Mapped[list["DialysisDosage"]] = relationship(
        back_populates="regimen", cascade="all, delete-orphan"
    )
    regimen_notes: Mapped[list["RegimenNote"]] = relationship(
        back_populates="regimen", cascade="all, delete-orphan"
    )


# ─── 8. dosage_values ─────────────────────────────────────────────


class DosageValue(Base):
    __tablename__ = "dosage_values"
    __table_args__ = (
        UniqueConstraint("regimen_id", "crcl_range_id", name="uq_dosage_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    regimen_id: Mapped[int] = mapped_column(
        ForeignKey("dosage_regimens.id", ondelete="CASCADE")
    )
    crcl_range_id: Mapped[int] = mapped_column(
        ForeignKey("crcl_ranges.id", ondelete="CASCADE")
    )
    dose_text: Mapped[str] = mapped_column(Text)
    dose_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    dose_unit: Mapped[Optional[str]] = mapped_column(String(20))
    frequency: Mapped[Optional[str]] = mapped_column(String(50))
    is_sequential: Mapped[bool] = mapped_column(Boolean, default=False)

    regimen: Mapped["DosageRegimen"] = relationship(back_populates="dosage_values")
    crcl_range: Mapped["CrclRange"] = relationship(back_populates="dosage_values")
    steps: Mapped[list["DosageStep"]] = relationship(
        back_populates="dosage_value", cascade="all, delete-orphan"
    )


# ─── 9. dosage_steps ──────────────────────────────────────────────


class DosageStep(Base):
    __tablename__ = "dosage_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    dosage_value_id: Mapped[int] = mapped_column(
        ForeignKey("dosage_values.id", ondelete="CASCADE")
    )
    step_order: Mapped[int] = mapped_column(Integer)
    step_text: Mapped[str] = mapped_column(Text)
    dose_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    dose_unit: Mapped[Optional[str]] = mapped_column(String(20))
    frequency: Mapped[Optional[str]] = mapped_column(String(50))
    duration: Mapped[Optional[str]] = mapped_column(String(100))

    dosage_value: Mapped["DosageValue"] = relationship(back_populates="steps")


# ─── 10. dialysis_dosages ─────────────────────────────────────────


class DialysisDosage(Base):
    __tablename__ = "dialysis_dosages"

    id: Mapped[int] = mapped_column(primary_key=True)
    regimen_id: Mapped[int] = mapped_column(
        ForeignKey("dosage_regimens.id", ondelete="CASCADE")
    )
    dialysis_type: Mapped[DialysisType] = mapped_column(
        Enum(DialysisType, name="dialysis_type")
    )
    dose_text: Mapped[str] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    regimen: Mapped["DosageRegimen"] = relationship(back_populates="dialysis_dosages")


# ─── 11. toxicities ───────────────────────────────────────────────


class Toxicity(Base):
    __tablename__ = "toxicities"

    id: Mapped[int] = mapped_column(primary_key=True)
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    category: Mapped[ToxicityCategory] = mapped_column(
        Enum(ToxicityCategory, name="toxicity_category")
    )
    description: Mapped[str] = mapped_column(Text)

    antibiotic: Mapped["Antibiotic"] = relationship(back_populates="toxicities")


# ─── 12a. empiric_syndromes ───────────────────────────────────────


class EmpiricSyndrome(Base):
    __tablename__ = "empiric_syndromes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)

    recommendations: Mapped[list["EmpiricRecommendation"]] = relationship(
        back_populates="syndrome", cascade="all, delete-orphan"
    )


# ─── 12b. empiric_recommendations ─────────────────────────────────


class EmpiricRecommendation(Base):
    __tablename__ = "empiric_recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    syndrome_id: Mapped[int] = mapped_column(
        ForeignKey("empiric_syndromes.id", ondelete="CASCADE")
    )
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    tier: Mapped[EmpiricTier] = mapped_column(Enum(EmpiricTier, name="empiric_tier"))
    is_addon: Mapped[bool] = mapped_column(Boolean, default=False)
    addon_notes: Mapped[Optional[str]] = mapped_column(Text)

    syndrome: Mapped["EmpiricSyndrome"] = relationship(
        back_populates="recommendations"
    )
    antibiotic: Mapped["Antibiotic"] = relationship(
        back_populates="empiric_recommendations"
    )


# ─── 13a. institutions ────────────────────────────────────────────


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(50), unique=True)

    coverage_overrides: Mapped[list["CoverageOverride"]] = relationship(
        back_populates="institution", cascade="all, delete-orphan"
    )


# ─── 13b. coverage_overrides ──────────────────────────────────────


class CoverageOverride(Base):
    __tablename__ = "coverage_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE")
    )
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    pathogen_id: Mapped[int] = mapped_column(
        ForeignKey("pathogens.id", ondelete="CASCADE")
    )
    is_covered: Mapped[bool] = mapped_column(Boolean)

    institution: Mapped["Institution"] = relationship(
        back_populates="coverage_overrides"
    )


# ─── 14. pathogen_relationships ───────────────────────────────────


class PathogenRelationship(Base):
    __tablename__ = "pathogen_relationships"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_pathogen_id: Mapped[int] = mapped_column(
        ForeignKey("pathogens.id", ondelete="CASCADE")
    )
    implies_pathogen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("pathogens.id", ondelete="CASCADE")
    )
    excludes_pathogen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("pathogens.id", ondelete="CASCADE")
    )

    parent_pathogen: Mapped["Pathogen"] = relationship(
        foreign_keys=[parent_pathogen_id]
    )
    implies_pathogen: Mapped[Optional["Pathogen"]] = relationship(
        foreign_keys=[implies_pathogen_id]
    )
    excludes_pathogen: Mapped[Optional["Pathogen"]] = relationship(
        foreign_keys=[excludes_pathogen_id]
    )


# ─── Extra: antibiotic_notes (mentioned in ER diagram) ────────────


class AntibioticNote(Base):
    __tablename__ = "antibiotic_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    antibiotic_id: Mapped[int] = mapped_column(
        ForeignKey("antibiotics.id", ondelete="CASCADE")
    )
    note_type: Mapped[str] = mapped_column(String(50))  # 'doctor', 'nurse', 'general'
    content: Mapped[str] = mapped_column(Text)

    antibiotic: Mapped["Antibiotic"] = relationship(back_populates="notes")


# ─── Extra: regimen_notes (mentioned in ER diagram) ───────────────


class RegimenNote(Base):
    __tablename__ = "regimen_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    regimen_id: Mapped[int] = mapped_column(
        ForeignKey("dosage_regimens.id", ondelete="CASCADE")
    )
    note_type: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text)

    regimen: Mapped["DosageRegimen"] = relationship(back_populates="regimen_notes")
