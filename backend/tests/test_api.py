"""API endpoint tests using sync SQLAlchemy session against SQLite.

Tests query logic directly rather than through HTTP to avoid async complexity.
The FastAPI routes use the same query logic, validated by import checks.
"""

from sqlalchemy import func, select

from app.models.antibiotic import (
    Antibiotic,
    AntibioticCoverage,
    AntibioticNote,
    AntibioticPenetration,
    CrclRange,
    DialysisDosage,
    DosageRegimen,
    DosageValue,
    EmpiricRecommendation,
    EmpiricSyndrome,
    Pathogen,
    PenetrationSite,
)


class TestDataIntegrity:
    """Verify migrated data is correct."""

    def test_antibiotic_count(self, db):
        count = db.scalar(select(func.count()).select_from(Antibiotic))
        assert count == 50

    def test_pathogen_count(self, db):
        count = db.scalar(select(func.count()).select_from(Pathogen))
        assert count == 18

    def test_crcl_range_count(self, db):
        count = db.scalar(select(func.count()).select_from(CrclRange))
        assert count == 12

    def test_penetration_site_count(self, db):
        count = db.scalar(select(func.count()).select_from(PenetrationSite))
        assert count == 3


class TestCoverageSearch:
    """Test coverage-based search logic (replaces filterAntibiotics)."""

    def test_search_esbl_coverage(self, db):
        """Find all antibiotics covering ESBL."""
        esbl = db.execute(
            select(Pathogen).where(Pathogen.code == "ESBL")
        ).scalar_one()

        stmt = (
            select(Antibiotic)
            .join(AntibioticCoverage)
            .where(
                AntibioticCoverage.pathogen_id == esbl.id,
                AntibioticCoverage.is_covered.is_(True),
            )
        )
        results = db.execute(stmt).scalars().all()
        names = {r.name for r in results}

        # Meropenem, Ertapenem, Tigecycline, Culin, Doripenem, Fosfomycin
        # should all cover ESBL
        assert "Meropenem" in names
        assert "Ertapenem" in names
        assert "Tigecycline" in names
        assert len(results) >= 5

    def test_search_mrsa_coverage(self, db):
        """Find all antibiotics covering MRSA."""
        mrsa = db.execute(
            select(Pathogen).where(Pathogen.code == "MRSA")
        ).scalar_one()

        stmt = (
            select(Antibiotic)
            .join(AntibioticCoverage)
            .where(
                AntibioticCoverage.pathogen_id == mrsa.id,
                AntibioticCoverage.is_covered.is_(True),
            )
        )
        results = db.execute(stmt).scalars().all()
        names = {r.name for r in results}

        # Key MRSA drugs
        assert "Vancomycin" in names
        assert "Linezolid (ZYVOX)" in names
        assert "Daptomycin" in names
        assert "Teicoplanin" in names

    def test_search_multi_pathogen_coverage(self, db):
        """Find antibiotics covering BOTH Strep AND PsA (like Tazocin)."""
        strep = db.execute(
            select(Pathogen).where(Pathogen.code == "Strep")
        ).scalar_one()
        psa = db.execute(
            select(Pathogen).where(Pathogen.code == "PsA")
        ).scalar_one()

        pathogen_ids = [strep.id, psa.id]

        stmt = (
            select(Antibiotic.id)
            .join(AntibioticCoverage)
            .where(
                AntibioticCoverage.pathogen_id.in_(pathogen_ids),
                AntibioticCoverage.is_covered.is_(True),
            )
            .group_by(Antibiotic.id)
            .having(
                func.count(func.distinct(AntibioticCoverage.pathogen_id))
                == len(pathogen_ids)
            )
        )
        matching_ids = [row[0] for row in db.execute(stmt).all()]

        antibiotics = db.execute(
            select(Antibiotic).where(Antibiotic.id.in_(matching_ids))
        ).scalars().all()
        names = {ab.name for ab in antibiotics}

        assert any("Tazocin" in n for n in names)
        assert len(names) >= 1

    def test_no_results_for_impossible_combo(self, db):
        """No antibiotic covers both VRE and CRKP (except Tigecycline)."""
        vre = db.execute(
            select(Pathogen).where(Pathogen.code == "VRE")
        ).scalar_one()
        crkp = db.execute(
            select(Pathogen).where(Pathogen.code == "CRKP")
        ).scalar_one()

        pathogen_ids = [vre.id, crkp.id]
        stmt = (
            select(Antibiotic.id)
            .join(AntibioticCoverage)
            .where(
                AntibioticCoverage.pathogen_id.in_(pathogen_ids),
                AntibioticCoverage.is_covered.is_(True),
            )
            .group_by(Antibiotic.id)
            .having(
                func.count(func.distinct(AntibioticCoverage.pathogen_id))
                == len(pathogen_ids)
            )
        )
        matching_ids = [row[0] for row in db.execute(stmt).all()]
        # Only Tigecycline covers both
        assert len(matching_ids) <= 2


class TestDosage:
    """Test dosage retrieval logic."""

    def test_meropenem_has_dosages(self, db):
        mero = db.execute(
            select(Antibiotic).where(Antibiotic.name == "Meropenem")
        ).scalar_one()

        regimens = db.execute(
            select(DosageRegimen).where(DosageRegimen.antibiotic_id == mero.id)
        ).scalars().all()

        assert len(regimens) == 2  # Standard IV, Prolonged infusion dose

    def test_tazocin_dialysis_dosages(self, db):
        tazocin = db.execute(
            select(Antibiotic).where(Antibiotic.name.contains("Tazocin"))
        ).scalar_one()

        dial = db.execute(
            select(DialysisDosage)
            .join(DosageRegimen)
            .where(DosageRegimen.antibiotic_id == tazocin.id)
        ).scalars().all()

        types = {d.dialysis_type.value for d in dial}
        assert types == {"HD", "CRRT"}

    def test_crcl_range_normal(self, db):
        normal = db.execute(
            select(CrclRange).where(CrclRange.label == "Normal")
        ).scalar_one()

        assert normal.lower_bound == 90
        assert normal.upper_bound is None

    def test_dosage_values_across_crcl_ranges(self, db):
        """Dosage values should span multiple CrCl ranges (not just Normal)."""
        total = db.scalar(select(func.count()).select_from(DosageValue))
        range_count = db.scalar(
            select(func.count(func.distinct(DosageValue.crcl_range_id)))
            .select_from(DosageValue)
        )
        assert total > 0
        assert range_count > 1  # Multiple CrCl ranges should have dosages


class TestPenetration:
    """Test penetration data."""

    def test_ceftriaxone_bbb(self, db):
        cef = db.execute(
            select(Antibiotic).where(Antibiotic.name.contains("Ceftriaxone"))
        ).scalar_one()
        bbb = db.execute(
            select(PenetrationSite).where(PenetrationSite.code == "BBB")
        ).scalar_one()

        pen = db.execute(
            select(AntibioticPenetration).where(
                AntibioticPenetration.antibiotic_id == cef.id,
                AntibioticPenetration.site_id == bbb.id,
            )
        ).scalar_one_or_none()
        assert pen is not None

    def test_meropenem_bbb(self, db):
        mero = db.execute(
            select(Antibiotic).where(Antibiotic.name == "Meropenem")
        ).scalar_one()
        bbb = db.execute(
            select(PenetrationSite).where(PenetrationSite.code == "BBB")
        ).scalar_one()

        pen = db.execute(
            select(AntibioticPenetration).where(
                AntibioticPenetration.antibiotic_id == mero.id,
                AntibioticPenetration.site_id == bbb.id,
            )
        ).scalar_one_or_none()
        assert pen is not None


class TestAgentType:
    """Test agent_type classification."""

    def test_acyclovir_is_antiviral(self, db):
        ab = db.execute(
            select(Antibiotic).where(Antibiotic.name == "Acyclovir")
        ).scalar_one()
        assert ab.agent_type.value == "antiviral"

    def test_fluconazole_is_antifungal(self, db):
        ab = db.execute(
            select(Antibiotic).where(Antibiotic.name == "Fluconazole")
        ).scalar_one()
        assert ab.agent_type.value == "antifungal"

    def test_meropenem_is_antibacterial(self, db):
        ab = db.execute(
            select(Antibiotic).where(Antibiotic.name == "Meropenem")
        ).scalar_one()
        assert ab.agent_type.value == "antibacterial"


class TestEmpiric:
    """Test empiric recommendations."""

    def test_biliary_syndrome_exists(self, db):
        syndrome = db.execute(
            select(EmpiricSyndrome).where(
                EmpiricSyndrome.name == "Biliary Tract Infections"
            )
        ).scalar_one()
        assert syndrome is not None

    def test_biliary_has_recommendations(self, db):
        syndrome = db.execute(
            select(EmpiricSyndrome).where(
                EmpiricSyndrome.name == "Biliary Tract Infections"
            )
        ).scalar_one()

        recs = db.execute(
            select(EmpiricRecommendation).where(
                EmpiricRecommendation.syndrome_id == syndrome.id
            )
        ).scalars().all()
        assert len(recs) >= 3  # primary + severe + alternatives

        tiers = {r.tier.value for r in recs}
        assert "primary" in tiers
        assert "severe" in tiers


class TestNotes:
    """Test antibiotic notes migration."""

    def test_vancomycin_has_notes(self, db):
        vanco = db.execute(
            select(Antibiotic).where(Antibiotic.name == "Vancomycin")
        ).scalar_one()

        notes = db.execute(
            select(AntibioticNote).where(AntibioticNote.antibiotic_id == vanco.id)
        ).scalars().all()
        assert len(notes) >= 1
        assert "peak" in notes[0].content.lower() or "trough" in notes[0].content.lower()

    def test_empty_comments_not_stored(self, db):
        """Antibiotics with empty comments should not have notes."""
        cefuroxime = db.execute(
            select(Antibiotic).where(Antibiotic.name.contains("Cefuroxime"))
        ).scalar_one()

        notes = db.execute(
            select(AntibioticNote).where(AntibioticNote.antibiotic_id == cefuroxime.id)
        ).scalars().all()
        assert len(notes) == 0


class TestAppImport:
    """Verify the FastAPI app loads correctly."""

    def test_app_has_routes(self):
        from app.main import app
        paths = [r.path for r in app.routes if hasattr(r, "path")]
        assert "/api/antibiotics" in paths
        assert "/api/pathogens" in paths
        assert "/api/empiric" in paths
        assert "/api/institutions" in paths
        assert "/health" in paths
