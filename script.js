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
        coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", Bili: true, Anae: "v" },
        resistance: { MDRAB: "++" },
        penetration: { Bili: true, UTI: true }
    },
    {
        name: "Tazocin (Pip/Tazo)",
        coverage: { Strep: "v", MSSA: "v", Efc: "v", Efm: "v", GNB: "+", Enbac: "++", Anae: "v" },
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
        coverage: { Strep: "v", MSSA: "v", Efc: "v", GNB: "v", Enbac: "++", Anae: "v" },
        resistance: { MRSA: "v", ESBL: "v" },
        penetration: { BBB: true, Pros: true, Bili: true, UTI: true }
    },
    {
        name: "Meropenem",
        coverage: { Strep: "v", MSSA: "v", Efc: "v", GNB: "+", Enbac: "++", Anae: "v" },
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
        coverage: { Anae: "v" },
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
        pathogens: ["GNB", "Anae", "Efc", "Bili"]
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['gender', 'age', 'weight', 'creatinine'];
    const inputElements = inputs.map(id => document.getElementById(id));
    const crclDisplay = document.getElementById('crcl-value');
    const resultsArea = document.getElementById('results-area');
    const syndromeChoice = document.getElementById('syndrome-choice');
    const summaryText = document.getElementById('summary-text');
    const copyBtn = document.getElementById('copy-summary');

    // Initialize listeners
    inputElements.forEach(el => el.addEventListener('input', updateUI));
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.addEventListener('change', updateUI));
    syndromeChoice.addEventListener('change', handleSyndromeChange);
    copyBtn.addEventListener('click', copySummary);

    function calculateCrCl() {
        const gender = document.getElementById('gender').value;
        const age = parseFloat(document.getElementById('age').value);
        const weight = parseFloat(document.getElementById('weight').value);
        const cr = parseFloat(document.getElementById('creatinine').value);

        if (!age || !weight || !cr) return null;

        let crcl = ((140 - age) * weight) / (72 * cr);
        if (gender === 'female') {
            crcl *= 0.85;
        }
        return crcl.toFixed(1);
    }

    function getSelectedCriteria() {
        const checked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
            .map(el => el.value);
        return checked;
    }

    function handleSyndromeChange() {
        const syndromeName = syndromeChoice.value;
        if (!syndromeName) return;

        const rule = EMPIRIC_RULES.find(r => r.syndrome === syndromeName);
        if (rule) {
            // Auto-check pathogens associated with this syndrome
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = rule.pathogens.includes(cb.value);
            });
            updateUI();
        }
    }

    function updateUI() {
        const crcl = calculateCrCl();
        crclDisplay.textContent = crcl || '--';

        const criteria = getSelectedCriteria();
        const results = filterAntibiotics(criteria);
        renderResults(results, criteria);
        updateSummary(crcl, criteria, results);
    }

    function filterAntibiotics(criteria) {
        if (criteria.length === 0) return [];

        return ANTIBIOTICS.filter(anti => {
            // Check if it covers ALL selected criteria
            return criteria.every(c => {
                const inCoverage = anti.coverage[c] || anti.resistance[c];
                const inPenetration = anti.penetration[c];
                return inCoverage || inPenetration;
            });
        });
    }

    function renderResults(results, criteria) {
        if (results.length === 0) {
            resultsArea.innerHTML = `
                <div class="empty-state">
                    ${criteria.length > 0 ? '找不到能涵蓋所有勾選條件的單一藥物。' : '請由左側勾選或選擇症候群以查看建議藥物'}
                </div>`;
            return;
        }

        resultsArea.innerHTML = results.map(anti => {
            const currentSyndrome = syndromeChoice.value;
            const syndromeRule = EMPIRIC_RULES.find(r => r.syndrome === currentSyndrome);
            const isPrimary = syndromeRule && syndromeRule.primary.includes(anti.name);

            return `
                <div class="anti-card ${isPrimary ? 'primary' : ''}">
                    <h4>${anti.name}</h4>
                    <div class="coverage-tags">
                        ${criteria.map(c => `<span class="tag match">${c}</span>`).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateSummary(crcl, criteria, results) {
        if (criteria.length === 0) {
            summaryText.textContent = '尚未產生摘要...';
            return;
        }

        let text = `[Anti Calculator Summary]\n`;
        text += `Patient: CrCl ${crcl || 'N/A'} ml/min\n`;
        text += `Spectrum/Criteria: ${criteria.join(', ')}\n`;
        text += `Suggested Options: ${results.map(r => r.name).join(', ') || 'No single coverage'}`;

        summaryText.textContent = text;
    }

    async function copySummary() {
        const text = summaryText.textContent;
        let success = false;

        try {
            // First attempt: Clipboard API
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                success = true;
            }
        } catch (err) {
            console.warn('Clipboard API failed, using fallback.');
        }

        if (!success) {
            // Fallback: Textarea selection (works on file:// and older browsers)
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                success = document.execCommand('copy');
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        }

        if (success) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '已複製！';
            copyBtn.style.background = '#059669';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        } else {
            alert('無法複製到剪貼簿，請手動選取摘要文字。');
        }
    }

    // Initial run
    updateUI();
});
