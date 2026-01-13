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
  },
  {
    name: "Amox-Clav/Curam/Augmentin",
    coverage: { Strep: "v" },
    resistance: {},
    penetration: { BBB: true, Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "1000/200mg Q8H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "1000/200mg x1, then 500/100mg QD", preferred: false },
    ],
    dialysisDosages: {
      HD: "1000/200mg x1, then 500/100mg QD (+ extra dose AD)",
    },
    comments: ""
  },
  {
    name: "Cefuroxime (2°)",
    coverage: { Strep: "v", MSSA: "v" },
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Cefoxitin (2°)",
    coverage: { Strep: "v", MSSA: "v" },
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "2g Q8H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "2g QD~QOD", preferred: false },
    ],
    dialysisDosages: {
      HD: "2g QD~QOD (+ extra 1g AD)",
    },
    comments: ""
  },
  {
    name: "Cefmetazole (2°)",
    coverage: { Strep: "v", MSSA: "v", Anae: "+" },
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "2g Q6H~Q8H~Q12H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "1~2g QOD", preferred: false },
    ],
    dialysisDosages: {
      HD: "1~2g QOD; AD",
    },
    comments: "需補充 Vit K1"
  },
  {
    name: "Cefixime (3°)",
    coverage: {},
    resistance: {},
    penetration: {},
    dosages: [
      { indication: "PO (General)", dose: "400mg QD or 200mg BID", preferred: true },
      { indication: "PO (CrCl <15 ml/min)", dose: "200mg QD", preferred: false },
    ],
    comments: ""
  },
  {
    name: "Ceftazidime (3°)",
    coverage: { PsA: "+" },
    resistance: {},
    penetration: { BBB: true, Pros: true, Endo: true, Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "1~2g Q8H~Q12H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "1~2g QD", preferred: false },
    ],
    dialysisDosages: {
      HD: "0.5~1.0g QD; AD",
    },
    comments: "不能用於GPC"
  },
  {
    name: "Flomoxef (Flumarin)",
    coverage: { Strep: "v", MSSA: "v", Anae: "++" },
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "1g Q6H~Q12H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "1g QD", preferred: false },
    ],
    dialysisDosages: {
      HD: "H/D 前、後 1g",
    },
    comments: "需補充 Vit K1"
  },
  {
    name: "Brosym (cefoperazone + sulbactam)(3°)",
    coverage: { Strep: "v", MSSA: "v", PsA: "+", Anae: "+" },
    resistance: { MDRAB: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "1~2g Cefoperazone Q12H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "0.5g Sulbactam Q12H", preferred: false },
    ],
    dialysisDosages: {
      HD: "0.5g Sulbactam Q12H, AD on dialysis day",
      CRRT: "1g Sulbactam Q8H",
    },
    comments: "需補充 Vit K1"
  },
  {
    name: "Zavicefta (Ceftazidime + Avibactam)",
    coverage: {},
    resistance: { CRKP: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "2.5g Q8H, drip > 2hrs", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "0.94g QD, drip > 2hrs", preferred: false },
    ],
    dialysisDosages: {
      HD: "As CrCl <= 15; AD",
    },
    comments: ""
  },
  {
    name: "Ceftobiprole (5°)",
    coverage: { Strep: "v", MSSA: "v", PsA: "++" },
    resistance: { MRSA: "+" },
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Cefiderocol",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "注入 10 mL 0.9% 生理食鹽水於 vial 中，並輕輕振搖使之溶解成 11.2 ml 的溶液，靜置直到表面泡沫消失 (通常於 2 分鐘內)，並從已配製完成的小瓶 (vial) 中抽 [] ml的溶液，並將其注入一內含 100 mL 的 0.9% 生理食鹽水袋中，完成製備"
  },
  {
    name: "Culin (Imipenem + Cilastatin)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", PsA: "+", Anae: "++" },
    resistance: { ESBL: "v", MDRAB: "v" },
    penetration: { BBB: true, Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "1g Q6H", preferred: true },
    ],
    dialysisDosages: {
      HD: "500mg Q12H; AD",
      CRRT: "500mg~1g Q12H",
    },
    comments: "會降低valproate血中濃度甚至導致癲癇發作;\nMeropenem susceptibility should not be relied upon as a surrogate to predict susceptibility to Imipenem"
  },
  {
    name: "Doripenem",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", PsA: "++", Anae: "++" },
    resistance: { ESBL: "v", MDRAB: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "會降低valproate血中濃度甚至導致癲癇發作;"
  },
  {
    name: "Moxifloxacin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", Anae: "+", Atyp: "++" },
    resistance: {},
    penetration: { BBB: true, Pros: true },
    dosages: [
      { indication: "IV (General)", dose: "400mg QD", preferred: true },
    ],
    dialysisDosages: {
      HD: "400mg QD",
      CRRT: "400mg QD",
    },
    comments: "注意 QTc prolonged; \nagainst respiratory and enteric pathogens"
  },
  {
    name: "Nemonoxacin",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Teicoplanin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v" },
    resistance: { MRSA: "++" },
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "480 Q12H x3 doses then 480mg QD", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "480 Q12H x3 doses then 480mg Q3D", preferred: false },
    ],
    dialysisDosages: {
      HD: "480 Q12H x3 doses then 480mg Q3D",
      CRRT: "480 Q12H x3 doses then 480mg QOD",
    },
    comments: "Not removed by HD; \nTarget trough (Normal): >15 μg/mL; \nTarget trough (Bone and joint): >20 μg/mL; \nTarget trough (Endocarditis): >30 μg/mL"
  },
  {
    name: "Vancomycin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v" },
    resistance: { MRSA: "++" },
    penetration: { BBB: true, Endo: true, Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "125mg Q6H x10 days", preferred: true },
    ],
    dialysisDosages: {
      HD: "125mg Q6H x10 days",
      CRRT: "125mg Q6H x10 days",
    },
    comments: "肺部穿透力差\nMIC>1mg/L的菌株，劑量易造成毒性; \nPeak：\n靜脈輸注完後 1 個小時抽血; 目前已不建議抽測 peak\nTrough：\n到達穩定狀態的抽血時間大約是四個劑量之後，即第 5 個劑量給藥前 30 分鐘抽血"
  },
  {
    name: "Daptomycin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v" },
    resistance: { MRSA: "++", VRE: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "400~480mg QD (請計算理想體重)", preferred: true },
    ],
    dialysisDosages: {
      HD: "於洗腎日在洗腎後給予",
    },
    comments: "會被Pulmonary surfactant分解，故不可用於Pneumonia & 右心 IE\n劑量以 Ideal BW 計算"
  },
  {
    name: "Linezolid (ZYVOX)",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v" },
    resistance: { MRSA: "++", VRE: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "600mg Q12H", preferred: true },
    ],
    dialysisDosages: {
      HD: "600mg Q12H; AD",
      CRRT: "600mg Q12H",
    },
    comments: ""
  },
  {
    name: "Minocycline",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "200mg Q12H", preferred: true },
    ],
    dialysisDosages: {
      HD: "200mg Q12H",
      CRRT: "200mg Q12H",
    },
    comments: "Infuse IV doses > 60 minutes;\n前驅物含Mg!!! 腎功能不佳者請監測"
  },
  {
    name: "Tigecycline",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", Anae: "+", Atyp: "+" },
    resistance: { MRSA: "++", ESBL: "v", VRE: "v", CRKP: "v" },
    penetration: {},
    dosages: [
      { indication: "IV (General)", dose: "100mg, then 25mg Q12h", preferred: true },
    ],
    dialysisDosages: {
      HD: "100mg, then 25mg Q12h",
      CRRT: "100mg, then 25mg Q12h",
    },
    comments: "先天抗藥性: P. aeruginosa, Providencia, Proteus, Morganella\n在血液及尿液中濃度低。單用會造成mortality 上升。\nChild-Pugh Class C: 100 mg IV, then 25 mg IV q12h"
  },
  {
    name: "Erythromycin",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "注意 QTc prolonged"
  },
  {
    name: "Azithromycin",
    coverage: { Atyp: "++" },
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "注意 QTc prolonged"
  },
  {
    name: "Clindamycin",
    coverage: { MSSA: "v", Anae: "+" },
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Colistin (polymyxin E)",
    coverage: { PsA: "+" },
    resistance: { MRSA: "+", MDRAB: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "2M IU Q8H", preferred: true },
    ],
    dialysisDosages: {
      HD: "2M IU Q8H",
      CRRT: "2M IU Q8H",
    },
    comments: "先天抗藥性: Serratia marcescens, Proteus mirabilis, Burkholderia spp., Stenotrophomonas maltophilia, Elizabethkingia spp., Morganella spp., Providencia spp., Moraxella catarrhalis\n1 vial = 2 百萬單位= CoIistimethate sodium (CMS) 160mg = CoIistin 66.8mg\n1 mg CBA (colistin base activity) = 30,000 IU CMS (colistimethate, prodrug) = 2.4 mg CMS"
  },
  {
    name: "Bobimixyn (Polymyxin B)",
    coverage: {},
    resistance: {},
    penetration: {},
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "請勿用於 UTI; 請勿使用 INHL\n先天抗藥性: Serratia marcescens, Proteus mirabilis, Burkholderia spp., Stenotrophomonas maltophilia, Elizabethkingia spp., Morganella spp., Providencia spp., Moraxella catarrhalis"
  },
  {
    name: "Amikacin",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "400~500mg Q12H", preferred: true },
    ],
    dialysisDosages: {
      HD: "400~500mg Q12H",
      CRRT: "400~500mg Q12H",
    },
    comments: "IV form 肺部穿透力差\nRun >1 hr; \n一天一次: Target Trough <1 μg/mL; Target peak 56-64 μg/mL; \n一天數次: Target Peak 15–30 μg/mL, Trough 5–10 μg/mL"
  },
  {
    name: "Rifampin",
    coverage: { Efc: "v", Efm: "v" },
    resistance: {},
    penetration: { BBB: true, Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Fosfomycin",
    coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v" },
    resistance: { ESBL: "v" },
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "須注意Hypernatremia; 經驗性使用 1g Q12H"
  },
  {
    name: "Fluconazole",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "IV (General)", dose: "100~400mg QD", preferred: true },
      { indication: "IV/PO (CrCl <15 ml/min)", dose: "50~200mg QD", preferred: false },
    ],
    dialysisDosages: {
      HD: "50-200 mg q24h (非洗腎日), 100-400 mg (full dose) AD (洗腎日)",
    },
    comments: "注意 QTc prolonged"
  },
  {
    name: "Voriconazole",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "PO (General)", dose: "240mg Q12H ST*2, then 120~160mg Q12H", preferred: true },
      { indication: "PO (CrCl <15 ml/min)", dose: "Avoid", preferred: false },
    ],
    dialysisDosages: {
      HD: "240mg Q12H ST*2, then 120~160mg Q12H",
      CRRT: "240mg Q12H ST*2, then 120~160mg Q12H",
    },
    comments: "注意 QTc prolonged"
  },
  {
    name: "Flucytosine",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Anidulafungin = ERAXIS",
    coverage: {},
    resistance: {},
    penetration: {},
    dosages: [
      { indication: "PO (General)", dose: "100mg ST, then 50mg QD", preferred: true },
    ],
    dialysisDosages: {
      HD: "100mg ST, then 50mg QD",
      CRRT: "100mg ST, then 50mg QD",
    },
    comments: "不能治療 UTI"
  },
  {
    name: "Isavuconazole",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: "一支cresemba加入5 mL注射用水，輕輕搖晃，使粉末完全溶解, 之後稀釋,  之後再用normal \nsaline稀釋成20cc 從NG管灌, 灌完再沖10cc的水"
  },
  {
    name: "Amphotericin B",
    coverage: {},
    resistance: {},
    penetration: { Bili: true },
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Acyclovir",
    coverage: {},
    resistance: {},
    penetration: {},
    dosages: [
      { indication: "IV (General)", dose: "200~500mg Q8H", preferred: true },
      { indication: "IV (CrCl <15 ml/min)", dose: "100~250mg QD", preferred: false },
    ],
    dialysisDosages: {
      HD: "100~250mg QD; AD",
      CRRT: "100~250mg QD",
    },
    comments: "Herpes simplex virus\nVaricella-zoster virus\n(not CMV)\n腦炎、腦膜炎10/kg\npost-hydration + pre-hydration"
  },
  {
    name: "Ganciclovir",
    coverage: {},
    resistance: {},
    penetration: {},
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
  {
    name: "Peramivir = Rapiacta",
    coverage: {},
    resistance: {},
    penetration: {},
    dosages: [
      { indication: "General", dose: "No data", preferred: true },
    ],
    comments: ""
  },
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
