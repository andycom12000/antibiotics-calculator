"""initial schema - all 18 tables

Revision ID: 001
Revises:
Create Date: 2026-02-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ENUM types ---
    antibiotic_category = sa.Enum(
        "penicillin", "cephalosporin", "carbapenem", "fluoroquinolone",
        "glycopeptide", "oxazolidinone", "tetracycline", "macrolide",
        "lincosamide", "polymyxin", "aminoglycoside", "other",
        name="antibiotic_category",
    )
    agent_type = sa.Enum("antibacterial", "antifungal", "antiviral", name="agent_type")
    pathogen_type = sa.Enum("spectrum", "resistance", name="pathogen_type")
    route = sa.Enum("IV", "PO", "INHL", "IV/PO", "IV/IM", "IM", "topical", name="route")
    weight_type = sa.Enum("actual", "ideal", "adjusted", name="weight_type")
    dialysis_type = sa.Enum("HD", "PD", "CRRT", name="dialysis_type")
    toxicity_category = sa.Enum(
        "general", "renal", "hepatic", "cardiac", "neurologic",
        "musculoskeletal", "gi", "skin", "obgyn", "hematologic", "endocrine",
        name="toxicity_category",
    )
    empiric_tier = sa.Enum("primary", "severe", "alternative", name="empiric_tier")

    # --- Independent tables ---

    op.create_table(
        "antibiotics",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("generic_name", sa.String(255)),
        sa.Column("category", antibiotic_category, nullable=False),
        sa.Column("agent_type", agent_type, nullable=False),
        sa.Column("generation", sa.String(10)),
        sa.Column("notes_for_doctor", sa.Text),
        sa.Column("notes_for_nurse", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "pathogens",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("pathogen_type", pathogen_type, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "penetration_sites",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "crcl_ranges",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("label", sa.String(50), nullable=False, unique=True),
        sa.Column("lower_bound", sa.Numeric(6, 2)),
        sa.Column("upper_bound", sa.Numeric(6, 2)),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "empiric_syndromes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
    )

    op.create_table(
        "institutions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
    )

    # --- Dependent tables (level 1) ---

    op.create_table(
        "antibiotic_coverage",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pathogen_id", sa.Integer, sa.ForeignKey("pathogens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_covered", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("antibiotic_id", "pathogen_id", name="uq_coverage"),
    )

    op.create_table(
        "antibiotic_penetration",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_id", sa.Integer, sa.ForeignKey("penetration_sites.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("antibiotic_id", "site_id", name="uq_penetration"),
    )

    op.create_table(
        "antibiotic_notes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
    )

    op.create_table(
        "dosage_regimens",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("route", route, nullable=False),
        sa.Column("indication", sa.String(255)),
        sa.Column("dose_descriptor", sa.String(255)),
        sa.Column("is_weight_based", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("weight_type", weight_type),
        sa.Column("is_preferred", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("fixed_duration", sa.String(100)),
        sa.Column("preparation_instructions", sa.Text),
        sa.Column("notes_for_doctor", sa.Text),
        sa.Column("notes_for_nurse", sa.Text),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "toxicities",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", toxicity_category, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
    )

    op.create_table(
        "empiric_recommendations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("syndrome_id", sa.Integer, sa.ForeignKey("empiric_syndromes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tier", empiric_tier, nullable=False),
        sa.Column("is_addon", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("addon_notes", sa.Text),
    )

    op.create_table(
        "coverage_overrides",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("institution_id", sa.Integer, sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("antibiotic_id", sa.Integer, sa.ForeignKey("antibiotics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pathogen_id", sa.Integer, sa.ForeignKey("pathogens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_covered", sa.Boolean, nullable=False),
    )

    op.create_table(
        "pathogen_relationships",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("parent_pathogen_id", sa.Integer, sa.ForeignKey("pathogens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("implies_pathogen_id", sa.Integer, sa.ForeignKey("pathogens.id", ondelete="CASCADE")),
        sa.Column("excludes_pathogen_id", sa.Integer, sa.ForeignKey("pathogens.id", ondelete="CASCADE")),
    )

    # --- Dependent tables (level 2) ---

    op.create_table(
        "dialysis_dosages",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("regimen_id", sa.Integer, sa.ForeignKey("dosage_regimens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dialysis_type", dialysis_type, nullable=False),
        sa.Column("dose_text", sa.Text, nullable=False),
        sa.Column("notes", sa.Text),
    )

    op.create_table(
        "dosage_values",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("regimen_id", sa.Integer, sa.ForeignKey("dosage_regimens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("crcl_range_id", sa.Integer, sa.ForeignKey("crcl_ranges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dose_text", sa.Text, nullable=False),
        sa.Column("dose_amount", sa.Numeric(10, 2)),
        sa.Column("dose_unit", sa.String(20)),
        sa.Column("frequency", sa.String(50)),
        sa.Column("is_sequential", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("regimen_id", "crcl_range_id", name="uq_dosage_value"),
    )

    op.create_table(
        "regimen_notes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("regimen_id", sa.Integer, sa.ForeignKey("dosage_regimens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
    )

    # --- Dependent tables (level 3) ---

    op.create_table(
        "dosage_steps",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("dosage_value_id", sa.Integer, sa.ForeignKey("dosage_values.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_order", sa.Integer, nullable=False),
        sa.Column("step_text", sa.Text, nullable=False),
        sa.Column("dose_amount", sa.Numeric(10, 2)),
        sa.Column("dose_unit", sa.String(20)),
        sa.Column("frequency", sa.String(50)),
        sa.Column("duration", sa.String(100)),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("dosage_steps")
    op.drop_table("regimen_notes")
    op.drop_table("dosage_values")
    op.drop_table("dialysis_dosages")
    op.drop_table("pathogen_relationships")
    op.drop_table("coverage_overrides")
    op.drop_table("empiric_recommendations")
    op.drop_table("toxicities")
    op.drop_table("dosage_regimens")
    op.drop_table("antibiotic_notes")
    op.drop_table("antibiotic_penetration")
    op.drop_table("antibiotic_coverage")
    op.drop_table("institutions")
    op.drop_table("empiric_syndromes")
    op.drop_table("crcl_ranges")
    op.drop_table("penetration_sites")
    op.drop_table("pathogens")
    op.drop_table("antibiotics")

    # Drop ENUM types
    for enum_name in [
        "empiric_tier", "toxicity_category", "dialysis_type",
        "weight_type", "route", "pathogen_type", "agent_type",
        "antibiotic_category",
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
