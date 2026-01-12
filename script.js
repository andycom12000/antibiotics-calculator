// Data is loaded from data.js - no duplicate definitions needed here

document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['gender', 'age', 'weight', 'creatinine'];
    const inputElements = inputs.map(id => document.getElementById(id));
    const crclDisplay = document.getElementById('crcl-value');
    const resultsArea = document.getElementById('results-area');
    const summaryText = document.getElementById('summary-text');
    const manualToggle = document.getElementById('manual-crcl-toggle');
    const manualInput = document.getElementById('manual-crcl');
    const inputsWrapper = document.getElementById('patient-inputs-wrapper');
    const dialysisSelect = document.getElementById('dialysis');

    // Initialize listeners
    inputElements.forEach(el => el.addEventListener('input', updateUI));
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        // Keep checkbox changes for pathogen selection, but avoid double-handling the manual toggle here
        if (el.id !== 'manual-crcl-toggle') el.addEventListener('change', updateUI);
    });

    // Manual CrCl toggle: show a single CrCl input inside the grid and hide original inputs
    manualToggle.addEventListener('change', () => {
        const manualOn = manualToggle.checked;
        if (manualOn) {
            if (inputsWrapper) inputsWrapper.classList.add('manual-on');
            if (manualInput) manualInput.focus();
            // Uncheck all other checkboxes (keep only manual toggle state)
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.id && cb.id !== 'manual-crcl-toggle') cb.checked = false;
            });
        } else {
            if (inputsWrapper) inputsWrapper.classList.remove('manual-on');
            if (manualInput) manualInput.value = '';
        }
        inputElements.forEach(el => el.disabled = manualOn);
        updateUI();
    });
    if (manualInput) manualInput.addEventListener('input', updateUI);

    // Apply initial manual toggle state in case of persisted HTML state
    if (manualToggle && manualToggle.checked) {
        if (inputsWrapper) inputsWrapper.classList.add('manual-on');
        if (manualInput) manualInput.focus();
        inputElements.forEach(el => el.disabled = true);
    }

    dialysisSelect.addEventListener('change', updateUI);

    function calculateCrCl() {
        const manualOn = manualToggle && manualToggle.checked;
        if (manualOn && manualInput) {
            const manualVal = parseFloat(manualInput.value);
            if (isNaN(manualVal) || manualVal <= 0) return null;
            return manualVal.toFixed(1);
        }

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
            .filter(el => el.id !== 'manual-crcl-toggle')
            .map(el => el.value);
        return checked;
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
            const isPrimary = false;

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
            const manualOn = manualToggle && manualToggle.checked;
            text += `Patient: CrCl ${crcl || 'N/A'} ml/min${manualOn ? ' (manual)' : ''}\n`;
            text += `Showing all antibiotics (${results.length} total)`;
            summaryText.textContent = text;
            return;
        }

        let text = `[Anti Calculator Summary]\n`;
        const manualOn = manualToggle && manualToggle.checked;
        text += `Patient: CrCl ${crcl || 'N/A'} ml/min${manualOn ? ' (manual)' : ''}\n`;
        text += `Spectrum/Criteria: ${criteria.join(', ')}\n`;
        text += `Suggested Options: ${results.map(r => r.name).join(', ') || 'No single coverage'}`;

        summaryText.textContent = text;
    }



    // Initial run
    updateUI();
});
