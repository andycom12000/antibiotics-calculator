const ANTIBIOTICS = [
  {
    name: "Baktar (TMP/SMX)",
    coverage: { Strep: "v", MSSA: "v", GNB: "", PsA: "" },
    resistance: { MRSA: "v", ESBL: "", VRE: "", MDRAB: "", CRKP: "" },
    penetration: { BBB: false, Pros: false, Endo: false, Bili: false, UTI: true },
    dosages: [
      { indication: "PO (UTI)", dose: "1 DS tab BID", preferred: true },
      { indication: "IV (Severe infection)", dose: "5mg/kg TMP Q8H", preferred: false },
      { indication: "IV (PCP treatment)", dose: "15-20mg/kg/day TMP divided Q6-8H", preferred: false }
    ],
    dialysisDosages: {
      HD: "1 DS tab post-HD on dialysis days",
      PD: "1 DS tab Q24H",
      CRRT: "1 DS tab Q12H"
    },
    comments: "Avoid if CrCl <15 ml/min. Risk of hyperkalemia. Check for sulfa allergy. Useful for MRSA coverage."
  },
  {
    name: "Oxacillin",
    coverage: { Strep: "v", MSSA: "v" },
    resistance: {},
    penetration: { UTI: false },
    dosages: [
      { indication: "IV (Mild-moderate)", dose: "1-2g Q4-6H", preferred: true },
      { indication: "IV (Severe/endocarditis)", dose: "2g Q4H", preferred: false }
    ],
    comments: "Anti-staphylococcal penicillin. No MRSA coverage. Monitor for hepatotoxicity. Consider Nafcillin as alternative."
  },
  {
    name: "Ampicillin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v" },
    resistance: { MDRAB: "++" },
    penetration: { UTI: true },
    dosages: [
      { indication: "IV (General)", dose: "1-2g Q4-6H", preferred: true },
      { indication: "IV (Meningitis)", dose: "2g Q4H", preferred: false },
      { indication: "IV (Endocarditis)", dose: "2g Q4H", preferred: false }
    ],
    comments: "Good for Enterococcus faecalis. Often given with aminoglycoside for synergy. High rate of resistance."
  },
  {
    name: "Unasyn (Amp/Sulb)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", Bili: true },
    resistance: { MDRAB: "++" },
    penetration: { Bili: true, UTI: true },
    dosages: [
      { indication: "IV (General)", dose: "1.5-3g Q6H", preferred: true },
      { indication: "IV (Severe/MDRAB)", dose: "3g Q6H", preferred: false }
    ],
    comments: "Excellent for MDRAB (Acinetobacter). Good for intra-abdominal and biliary infections. Adjust for renal function."
  },
  {
    name: "Tazocin (Pip/Tazo)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", GNB: "+", Enbac: "++" },
    resistance: {},
    penetration: { Bili: true, UTI: true },
    dosages: [
      { indication: "IV", dose: "3.375g Q6H", preferred: true },
      { indication: "IV (Nosocomial pneumonia)", dose: "4.5g Q6H", preferred: false },
      { indication: "IV (Extended infusion)", dose: "4.5g Q8H (>4hrs)", preferred: false }
    ],
    dialysisDosages: {
      HD: "2.25g Q8H (give after HD on dialysis days)",
      PD: "2.25g Q6-8H",
      CRRT: "3.375g Q6-8H"
    },
    comments: "Adjust dosing based on renal function. For CrCl 20-40 ml/min, consider Q8H dosing."
  },
  {
    name: "Ceftriaxone (3°)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v" },
    resistance: {},
    penetration: { BBB: true, Pros: true, Endo: true, Bili: true },
    dosages: [
      { indication: "IV/IM (General)", dose: "1-2g Q24H", preferred: true },
      { indication: "IV (Meningitis)", dose: "2g Q12H", preferred: false },
      { indication: "IV (Severe infection)", dose: "2g Q24H", preferred: false }
    ],
    dialysisDosages: {
      HD: "No adjustment needed (not dialyzed)",
      PD: "No adjustment needed",
      CRRT: "2g Q12-24H"
    },
    comments: "Once-daily dosing advantage. Good CNS penetration. Caution with neonates (bilirubin displacement)."
  },
  {
    name: "Cefepime (4°)",
    coverage: { Strep: "v", MSSA: "v", GNB: "++" },
    resistance: {},
    penetration: { BBB: true, UTI: true },
    dosages: [
      { indication: "IV (General)", dose: "1-2g Q8-12H", preferred: true },
      { indication: "IV (Severe/Pseudomonas)", dose: "2g Q8H", preferred: false },
      { indication: "IV (Febrile neutropenia)", dose: "2g Q8H", preferred: false }
    ],
    dialysisDosages: {
      HD: "1-2g Q24H (give after HD)",
      PD: "1g Q24H",
      CRRT: "2g Q12H"
    },
    comments: "Broad-spectrum 4th gen cephalosporin. Good Pseudomonas coverage. Reduce dose in renal impairment to avoid neurotoxicity."
  },
  {
    name: "Ertapenem",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Enbac: "++" },
    resistance: { MRSA: "v", ESBL: "v" },
    penetration: { BBB: true, Pros: true, Bili: true, UTI: true },
    dosages: [
      { indication: "IV/IM (Once daily)", dose: "1g Q24H", preferred: true },
      { indication: "IV (ESBL organism)", dose: "1g Q24H", preferred: false }
    ],
    comments: "Once-daily carbapenem. Good for ESBL organisms. NO Pseudomonas or Acinetobacter coverage. Ideal for outpatient IV therapy."
  },
  {
    name: "Meropenem",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", GNB: "+", Enbac: "++" },
    resistance: { MRSA: "v", ESBL: "v" },
    penetration: { BBB: true, Pros: true, Endo: true, Bili: true, UTI: true },
    dosages: [
      { indication: "IV (General infection)", dose: "1g Q8H", preferred: true },
      { indication: "IV (Meningitis)", dose: "2g Q8H", preferred: false },
      { indication: "IV (Extended infusion)", dose: "1g Q8H (3hrs infusion)", preferred: false }
    ],
    dialysisDosages: {
      HD: "500mg Q24H (give after HD)",
      PD: "500mg Q24H",
      CRRT: "1g Q8-12H"
    },
    comments: "Broad-spectrum carbapenem. Adjust for renal function. Consider ID consult for carbapenem-resistant organisms."
  },
  {
    name: "Ciprofloxacin",
    coverage: { MSSA: "v", Efc: "v", GNB: "+", Enbac: "+" },
    resistance: {},
    penetration: { BBB: true, Pros: true },
    dosages: [
      { indication: "PO (UTI)", dose: "250-500mg BID", preferred: true },
      { indication: "IV (Severe infection)", dose: "400mg Q8-12H", preferred: false },
      { indication: "PO (Prostatitis)", dose: "500mg BID", preferred: false }
    ],
    comments: "Good GNB and Pseudomonas coverage. Avoid in pregnancy. Risk of tendon rupture, QT prolongation. High resistance rates in some areas."
  },
  {
    name: "Levofloxacin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Enbac: "++", PsA: "v" },
    resistance: {},
    penetration: { BBB: true, Pros: true },
    dosages: [
      { indication: "PO/IV (CAP)", dose: "750mg Q24H", preferred: true },
      { indication: "PO/IV (UTI)", dose: "250-500mg Q24H", preferred: false },
      { indication: "PO/IV (Nosocomial pneumonia)", dose: "750mg Q24H", preferred: false }
    ],
    dialysisDosages: {
      HD: "750mg Q48H",
      PD: "750mg Q48H",
      CRRT: "750mg Q24H"
    },
    comments: "Better Strep coverage than Cipro. Once-daily dosing. Good respiratory penetration. Monitor for QT prolongation and tendinopathy."
  },
  {
    name: "Metronidazole",
    coverage: {},
    resistance: {},
    penetration: { BBB: true, Bili: true, UTI: true },
    dosages: [
      { indication: "IV/PO (Anaerobic infection)", dose: "500mg Q6-8H", preferred: true },
      { indication: "PO (C. difficile)", dose: "500mg TID", preferred: false },
      { indication: "IV (CNS infection)", dose: "500mg Q6H", preferred: false }
    ],
    dialysisDosages: {
      HD: "500mg Q8H (no supplemental dose)",
      PD: "500mg Q6-8H",
      CRRT: "500mg Q6-8H"
    },
    comments: "Excellent anaerobic coverage. Good CNS penetration. Avoid alcohol (disulfiram reaction). Metallic taste common."
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

// Make data available globally (no module exports needed for simple script tag usage)
