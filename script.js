// Data is loaded from data.js - no duplicate definitions needed here

document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['gender', 'age', 'weight', 'creatinine'];
    const inputElements = inputs.map(id => document.getElementById(id));
    const crclDisplay = document.getElementById('crcl-value');
    const resultsArea = document.getElementById('results-area');
    const syndromeChoice = document.getElementById('syndrome-choice');
    const summaryText = document.getElementById('summary-text');
    const copyBtn = document.getElementById('copy-summary');
    const dialysisSelect = document.getElementById('dialysis');

    // Initialize listeners
    inputElements.forEach(el => el.addEventListener('input', updateUI));
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.addEventListener('change', updateUI));
    syndromeChoice.addEventListener('change', handleSyndromeChange);
    dialysisSelect.addEventListener('change', updateUI);
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
        // Show all antibiotics when no criteria are selected
        if (criteria.length === 0) return ANTIBIOTICS;

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
                    找不到能涵蓋所有勾選條件的單一藥物。請調整選擇條件。
                </div>`;
            return;
        }

        const dialysisStatus = dialysisSelect.value;

        resultsArea.innerHTML = results.map(anti => {
            const currentSyndrome = syndromeChoice.value;
            const syndromeRule = EMPIRIC_RULES.find(r => r.syndrome === currentSyndrome);
            const isPrimary = syndromeRule && syndromeRule.primary.includes(anti.name);

            // Generate dosage section if available
            let dosageHTML = '';
            if (anti.dosages && anti.dosages.length > 0) {
                dosageHTML = `
                    <div class="dosage-section">
                        <h5>建議劑量</h5>
                        ${anti.dosages.map(d => `
                            <div class="dosage-item ${d.preferred ? 'preferred' : ''}">
                                <span class="indication">${d.indication}</span>
                                <span class="dose">${d.dose}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Generate dialysis dosage section if on dialysis
            let dialysisHTML = '';
            if (dialysisStatus !== 'none' && anti.dialysisDosages && anti.dialysisDosages[dialysisStatus]) {
                dialysisHTML = `
                    <div class="dosage-section dialysis-dosage">
                        <h5>透析劑量 (Dialysis Dosing)</h5>
                        <div class="dosage-item preferred">
                            <span class="indication">${dialysisStatus}</span>
                            <span class="dose">${anti.dialysisDosages[dialysisStatus]}</span>
                        </div>
                    </div>
                `;
            }

            // Generate comments section if available
            let commentsHTML = '';
            if (anti.comments) {
                commentsHTML = `
                    <div class="comments-section">
                        <h5>備註</h5>
                        <p>${anti.comments}</p>
                    </div>
                `;
            }

            return `
                <div class="anti-card ${isPrimary ? 'primary' : ''}">
                    <h4>${anti.name}</h4>
                    ${dosageHTML}
                    ${dialysisHTML}
                    ${commentsHTML}
                </div>
            `;
        }).join('');
    }

    function updateSummary(crcl, criteria, results) {
        if (criteria.length === 0) {
            let text = `[Anti Calculator Summary]\n`;
            text += `Patient: CrCl ${crcl || 'N/A'} ml/min\n`;
            text += `Showing all antibiotics (${results.length} total)`;
            summaryText.textContent = text;
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
