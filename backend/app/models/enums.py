import enum


class AntibioticCategory(str, enum.Enum):
    penicillin = "penicillin"
    cephalosporin = "cephalosporin"
    carbapenem = "carbapenem"
    fluoroquinolone = "fluoroquinolone"
    glycopeptide = "glycopeptide"
    oxazolidinone = "oxazolidinone"
    tetracycline = "tetracycline"
    macrolide = "macrolide"
    lincosamide = "lincosamide"
    polymyxin = "polymyxin"
    aminoglycoside = "aminoglycoside"
    other = "other"


class AgentType(str, enum.Enum):
    antibacterial = "antibacterial"
    antifungal = "antifungal"
    antiviral = "antiviral"


class PathogenType(str, enum.Enum):
    spectrum = "spectrum"
    resistance = "resistance"


class Route(str, enum.Enum):
    IV = "IV"
    PO = "PO"
    INHL = "INHL"
    IV_PO = "IV/PO"
    IV_IM = "IV/IM"
    IM = "IM"
    topical = "topical"


class WeightType(str, enum.Enum):
    actual = "actual"
    ideal = "ideal"
    adjusted = "adjusted"


class DialysisType(str, enum.Enum):
    HD = "HD"
    PD = "PD"
    CRRT = "CRRT"


class ToxicityCategory(str, enum.Enum):
    general = "general"
    renal = "renal"
    hepatic = "hepatic"
    cardiac = "cardiac"
    neurologic = "neurologic"
    musculoskeletal = "musculoskeletal"
    gi = "gi"
    skin = "skin"
    obgyn = "obgyn"
    hematologic = "hematologic"
    endocrine = "endocrine"


class EmpiricTier(str, enum.Enum):
    primary = "primary"
    severe = "severe"
    alternative = "alternative"
