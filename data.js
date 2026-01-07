const ANTIBIOTICS = [
  {
    name: "Baktar (TMP/SMX)",
    coverage: { Strep: "v", MSSA: "v", GNB: "", PsA: "" },
    resistance: { MRSA: "v", ESBL: "", VRE: "", MDRAB: "", CRKP: "" },
    penetration: { BBB: false, Pros: false, Endo: false, Bili: false, UTI: true }
  },
  {
    name: "Oxacillin",
    coverage: { Strep: "v", MSSA: "v" },
    resistance: {},
    penetration: { UTI: false }
  },
  {
    name: "Ampicillin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v" },
    resistance: { MDRAB: "++" },
    penetration: { UTI: true }
  },
  {
    name: "Unasyn (Amp/Sulb)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", Bili: true },
    resistance: { MDRAB: "++" },
    penetration: { Bili: true, UTI: true }
  },
  {
    name: "Tazocin (Pip/Tazo)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", GNB: "+", Enbac: "++" },
    resistance: {},
    penetration: { Bili: true, UTI: true }
  },
  {
    name: "Ceftriaxone (3°)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v" },
    resistance: {},
    penetration: { BBB: true, Pros: true, Endo: true, Bili: true }
  },
  {
    name: "Cefepime (4°)",
    coverage: { Strep: "v", MSSA: "v", GNB: "++" },
    resistance: {},
    penetration: { BBB: true, UTI: true }
  },
  {
    name: "Ertapenem",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Enbac: "++" },
    resistance: { MRSA: "v", ESBL: "v" },
    penetration: { BBB: true, Pros: true, Bili: true, UTI: true }
  },
  {
    name: "Meropenem",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", GNB: "+", Enbac: "++" },
    resistance: { MRSA: "v", ESBL: "v" },
    penetration: { BBB: true, Pros: true, Endo: true, Bili: true, UTI: true }
  },
  {
    name: "Ciprofloxacin",
    coverage: { MSSA: "v", Efc: "v", GNB: "+", Enbac: "+" },
    resistance: {},
    penetration: { BBB: true, Pros: true }
  },
  {
    name: "Levofloxacin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Enbac: "++", PsA: "v" },
    resistance: {},
    penetration: { BBB: true, Pros: true }
  },
  {
    name: "Metronidazole",
    coverage: {},
    resistance: {},
    penetration: { BBB: true, Bili: true, UTI: true }
  }
];

const EMPIRIC_RULES = [
  {
    syndrome: "Biliary Tract Infections",
    primary: ["Tazocin (Pip/Tazo)", "Ertapenem"],
    severe: ["Meropenem"],
    alternative: [
        "Ceftriaxone (3°) + Metronidazole",
        "Moxifloxacin",
        "Ciprofloxacin + Metronidazole",
        "Levofloxacin + Metronidazole"
    ],
    pathogens: ["GNB", "Anae", "Enterococcus"]
  }
];

export { ANTIBIOTICS, EMPIRIC_RULES };
