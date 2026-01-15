// State management
let selectedAntibiotics = new Set();
let filteredAntibiotics = [];

// Categorize antibiotics based on name
function categorizeAntibiotic(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('cillin') || nameLower.includes('amox') || nameLower.includes('ampicillin') ||
        nameLower.includes('oxacillin') || nameLower.includes('unasyn') || nameLower.includes('tazocin')) {
        return 'penicillin';
    }
    if (nameLower.includes('cef') || nameLower.includes('ceph')) {
        return 'cephalosporin';
    }
    if (nameLower.includes('penem') || nameLower.includes('culin')) {
        return 'carbapenem';
    }
    if (nameLower.includes('floxacin') || nameLower.includes('levofloxacin') || nameLower.includes('moxifloxacin') || nameLower.includes('ciprofloxacin')) {
        return 'quinolone';
    }
    if (nameLower.includes('vancomycin') || nameLower.includes('teicoplanin') || nameLower.includes('daptomycin') || nameLower.includes('linezolid')) {
        return 'glycopeptide';
    }
    return 'other';
}

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

    // Multiselect elements
    const multiselectContainer = document.getElementById('antibiotic-multiselect');
    const multiselectHeader = multiselectContainer.querySelector('.multiselect-header');
    const multiselectDropdown = multiselectContainer.querySelector('.multiselect-dropdown');
    const multiselectOptions = document.getElementById('multiselect-options');
    const selectedCountSpan = document.getElementById('selected-count');
    const searchInput = document.getElementById('antibiotic-search');

    // Initialize listeners
    inputElements.forEach(el => el.addEventListener('input', updateUI));
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        if (el.id !== 'manual-crcl-toggle') el.addEventListener('change', updateUI);
    });

    // Manual CrCl toggle
    manualToggle.addEventListener('change', () => {
        const manualOn = manualToggle.checked;
        if (manualOn) {
            if (inputsWrapper) inputsWrapper.classList.add('manual-on');
            if (manualInput) manualInput.focus();
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

    if (manualToggle && manualToggle.checked) {
        if (inputsWrapper) inputsWrapper.classList.add('manual-on');
        if (manualInput) manualInput.focus();
        inputElements.forEach(el => el.disabled = true);
    }

    dialysisSelect.addEventListener('change', updateUI);

    // Multiselect toggle
    multiselectHeader.addEventListener('click', () => {
        const isVisible = multiselectDropdown.style.display === 'block';
        multiselectDropdown.style.display = isVisible ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!multiselectContainer.contains(e.target)) {
            multiselectDropdown.style.display = 'none';
        }
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const options = multiselectOptions.querySelectorAll('.multiselect-option');
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });

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
            .filter(el => el.id !== 'manual-crcl-toggle' && el.value && !el.id.startsWith('anti-'))
            .map(el => el.value);
        return checked;
    }

    function updateUI() {
        const crcl = calculateCrCl();
        const dialysisStatus = dialysisSelect.value;
        const crclDisplayBox = document.querySelector('.crcl-display');
        const crclLabel = crclDisplayBox.querySelector('.label');
        const crclUnit = crclDisplayBox.querySelector('.unit');

        // Update display based on dialysis status
        if (dialysisStatus !== 'none') {
            // Dialysis mode: show dialysis status
            crclDisplayBox.classList.add('dialysis-warning');
            crclLabel.textContent = '透析狀態:';
            crclDisplay.textContent = dialysisStatus;
            crclUnit.textContent = '';
        } else {
            // Normal mode: show CrCl
            crclDisplayBox.classList.remove('dialysis-warning');
            crclLabel.textContent = '預估 CrCl:';
            crclDisplay.textContent = crcl || '--';
            crclUnit.textContent = 'ml/min';
        }

        const criteria = getSelectedCriteria();
        filteredAntibiotics = filterAntibiotics(criteria);
        updateMultiselectOptions();
        renderResults();
        updateSummary(crcl, criteria);
    }

    function filterAntibiotics(criteria) {
        if (criteria.length === 0) return ANTIBIOTICS;

        return ANTIBIOTICS.filter(anti => {
            return criteria.every(c => {
                const inCoverage = anti.coverage[c] || anti.resistance[c];
                const inPenetration = anti.penetration[c];
                return inCoverage || inPenetration;
            });
        });
    }

    function updateMultiselectOptions() {
        multiselectOptions.innerHTML = '';

        if (filteredAntibiotics.length === 0) {
            multiselectOptions.innerHTML = '<div style="padding: 1rem; text-align: center; color: #64748b;">沒有符合條件的抗生素</div>';
            return;
        }

        filteredAntibiotics.forEach(anti => {
            const category = categorizeAntibiotic(anti.name);
            const option = document.createElement('div');
            option.className = `multiselect-option category-${category}`;
            if (selectedAntibiotics.has(anti.name)) {
                option.classList.add('selected');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedAntibiotics.has(anti.name);

            const label = document.createElement('span');
            label.textContent = anti.name;

            // Click on entire option area to toggle
            option.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    selectedAntibiotics.add(anti.name);
                } else {
                    selectedAntibiotics.delete(anti.name);
                }
                option.classList.toggle('selected', checkbox.checked);
                updateSelectedCount();
                renderResults();
                updateSummary(calculateCrCl(), getSelectedCriteria());
            });

            option.appendChild(checkbox);
            option.appendChild(label);
            multiselectOptions.appendChild(option);
        });

        updateSelectedCount();
    }

    function updateSelectedCount() {
        const count = selectedAntibiotics.size;
        selectedCountSpan.textContent = count === 0 ? '尚未選擇' : `已選擇 ${count} 個抗生素`;
    }

    function renderResults() {
        // If no antibiotics selected, show filtered results
        const antibioticsToShow = selectedAntibiotics.size > 0
            ? filteredAntibiotics.filter(anti => selectedAntibiotics.has(anti.name))
            : [];

        if (antibioticsToShow.length === 0) {
            resultsArea.innerHTML = `
                <div class="empty-state">
                    ${selectedAntibiotics.size === 0
                        ? '請從左側選單選擇要查看的抗生素'
                        : '找不到符合條件的抗生素'}
                </div>`;
            return;
        }

        const dialysisStatus = dialysisSelect.value;

        resultsArea.innerHTML = antibioticsToShow.map(anti => {
            const category = categorizeAntibiotic(anti.name);

            let dosageHTML = '';
            if (dialysisStatus === 'none' && anti.dosages && anti.dosages.length > 0) {
                dosageHTML = `
                    <div class="dosage-section">
                        <h5>💊 建議劑量</h5>
                        ${anti.dosages.map(d => `
                            <div class="dosage-item ${d.preferred ? 'preferred' : ''}">
                                <span class="indication">${d.indication}</span>
                                <span class="dose">${d.dose}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            let dialysisHTML = '';
            if (dialysisStatus !== 'none' && anti.dialysisDosages && anti.dialysisDosages[dialysisStatus]) {
                dialysisHTML = `
                    <div class="dosage-section dialysis-dosage">
                        <h5>💊 透析劑量 (Dialysis Dosing)</h5>
                        <div class="dosage-item preferred">
                            <span class="indication">${dialysisStatus}</span>
                            <span class="dose">${anti.dialysisDosages[dialysisStatus]}</span>
                        </div>
                    </div>
                `;
            }

            let commentsHTML = '';
            if (anti.comments) {
                commentsHTML = `
                    <div class="comments-section">
                        <h5>📋 重要備註</h5>
                        <p>${anti.comments}</p>
                    </div>
                `;
            }

            return `
                <div class="anti-card category-${category}">
                    <h4>${anti.name}</h4>
                    ${dosageHTML}
                    ${dialysisHTML}
                    ${commentsHTML}
                </div>
            `;
        }).join('');
    }

    function updateSummary(crcl, criteria) {
        let text = `[Anti Calculator Summary]\n`;
        const manualOn = manualToggle && manualToggle.checked;
        text += `Patient: CrCl ${crcl || 'N/A'} ml/min${manualOn ? ' (manual)' : ''}\n`;

        if (criteria.length > 0) {
            text += `Spectrum/Criteria: ${criteria.join(', ')}\n`;
        }

        text += `Filtered antibiotics: ${filteredAntibiotics.length}\n`;
        text += `Selected for display: ${selectedAntibiotics.size}`;

        summaryText.textContent = text;
    }

    // Initial run
    updateUI();
});
