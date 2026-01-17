// State management
let selectedAntibiotics = new Set();
let filteredAntibiotics = [];

// All pathogens with display names
const ALL_PATHOGENS = {
    // Coverage pathogens
    'Strep': 'Streptococcus',
    'MSSA': 'MSSA',
    'Efc': 'E. faecalis',
    'Efm': 'E. faecium',
    'GNB': 'GNB (一般)',
    'Enbac': 'Enterobacter',
    'PsA': 'Pseudomonas',
    'Anae': '厭氧菌',
    // Resistance pathogens
    'MRSA': 'MRSA',
    'ESBL': 'ESBL',
    'VRE': 'VRE',
    'MDRAB': 'MDRAB',
    'CRKP': 'CRKP'
};

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

    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', () => {
        // Save collapsed states before reset
        const collapsibleSections = document.querySelectorAll('.collapsible');
        const collapsedStates = Array.from(collapsibleSections).map(section =>
            section.classList.contains('collapsed')
        );

        // Reset all spectrum/criteria checkboxes (not patient data)
        document.querySelectorAll('.selection-section input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Clear selected antibiotics
        selectedAntibiotics.clear();

        // Clear search input
        searchInput.value = '';

        // Update selected count display immediately
        selectedCountSpan.textContent = '尚未選擇';

        // Update UI
        updateUI();

        // Restore collapsed states after reset
        collapsibleSections.forEach((section, index) => {
            if (collapsedStates[index]) {
                section.classList.add('collapsed');
            } else {
                section.classList.remove('collapsed');
            }
        });
    });

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
        updateCoveragePanel();
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
            selectedAntibiotics.clear();
            updateSelectedCount();
            return;
        }

        // Remove selected antibiotics that are no longer in filtered list
        const filteredNames = new Set(filteredAntibiotics.map(a => a.name));
        for (const name of [...selectedAntibiotics]) {
            if (!filteredNames.has(name)) {
                selectedAntibiotics.delete(name);
            }
        }

        // Define category order for sorting
        const categoryOrder = {
            'penicillin': 1,
            'cephalosporin': 2,
            'carbapenem': 3,
            'quinolone': 4,
            'glycopeptide': 5,
            'other': 6
        };

        // Sort antibiotics by category
        const sortedAntibiotics = [...filteredAntibiotics].sort((a, b) => {
            const catA = categorizeAntibiotic(a.name);
            const catB = categorizeAntibiotic(b.name);
            return (categoryOrder[catA] || 99) - (categoryOrder[catB] || 99);
        });

        sortedAntibiotics.forEach(anti => {
            const category = categorizeAntibiotic(anti.name);
            const option = document.createElement('div');
            option.className = `multiselect-option category-${category}`;
            if (selectedAntibiotics.has(anti.name)) {
                option.classList.add('selected');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `anti-select-${anti.name.replace(/\s+/g, '-')}`;
            checkbox.checked = selectedAntibiotics.has(anti.name);

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = anti.name;

            // Toggle function for selection
            const toggleSelection = () => {
                const isSelected = selectedAntibiotics.has(anti.name);
                if (isSelected) {
                    selectedAntibiotics.delete(anti.name);
                } else {
                    selectedAntibiotics.add(anti.name);
                }
                checkbox.checked = !isSelected;
                option.classList.toggle('selected', !isSelected);
                updateSelectedCount();
                renderResults();
                updateSummary(calculateCrCl(), getSelectedCriteria());
                updateCoveragePanel();
            };

            // Click on entire option area to toggle (but prevent double-toggle from checkbox/label)
            option.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== label) {
                    toggleSelection();
                }
            });

            // Handle checkbox change directly
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleSelection();
            });

            // Handle label click
            label.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSelection();
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
        if (!summaryText) return;

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

    function updateCoveragePanel() {
        const coveredContainer = document.getElementById('covered-pathogens');
        const uncoveredContainer = document.getElementById('uncovered-pathogens');

        if (!coveredContainer || !uncoveredContainer) return;

        // Get selected antibiotic objects
        const selectedAntiList = ANTIBIOTICS.filter(a => selectedAntibiotics.has(a.name));

        if (selectedAntiList.length === 0) {
            coveredContainer.innerHTML = '<p class="empty-hint">尚未選擇抗生素</p>';
            uncoveredContainer.innerHTML = '<p class="empty-hint">尚未選擇抗生素</p>';
            return;
        }

        // Calculate coverage for each pathogen
        const coverageMap = {};
        for (const pathogenKey of Object.keys(ALL_PATHOGENS)) {
            coverageMap[pathogenKey] = { covered: false, level: '' };
        }

        // Check coverage from all selected antibiotics
        for (const anti of selectedAntiList) {
            // Check coverage object
            if (anti.coverage) {
                for (const [pathogen, level] of Object.entries(anti.coverage)) {
                    if (level && level !== '') {
                        coverageMap[pathogen] = { covered: true, level: level };
                    }
                }
            }
            // Check resistance object (these are also coverage capabilities)
            if (anti.resistance) {
                for (const [pathogen, level] of Object.entries(anti.resistance)) {
                    if (level && level !== '') {
                        coverageMap[pathogen] = { covered: true, level: level };
                    }
                }
            }
        }

        // Separate into covered and uncovered
        const covered = [];
        const uncovered = [];

        for (const [key, displayName] of Object.entries(ALL_PATHOGENS)) {
            if (coverageMap[key] && coverageMap[key].covered) {
                covered.push({ key, displayName, level: coverageMap[key].level });
            } else {
                uncovered.push({ key, displayName });
            }
        }

        // Render covered pathogens
        if (covered.length > 0) {
            coveredContainer.innerHTML = covered.map(p => `
                <span class="pathogen-tag covered">
                    ${p.displayName}
                    ${p.level && p.level !== 'v' ? `<span class="coverage-level">${p.level}</span>` : ''}
                </span>
            `).join('');
        } else {
            coveredContainer.innerHTML = '<p class="empty-hint">無覆蓋病原菌</p>';
        }

        // Render uncovered pathogens
        if (uncovered.length > 0) {
            uncoveredContainer.innerHTML = uncovered.map(p => `
                <span class="pathogen-tag uncovered">${p.displayName}</span>
            `).join('');
        } else {
            uncoveredContainer.innerHTML = '<p class="empty-hint">已覆蓋所有病原菌</p>';
        }
    }

    // Collapsible sections
    document.querySelectorAll('.collapsible .section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.collapsible');
            section.classList.toggle('collapsed');
        });
    });

    // Initial run
    updateUI();
});
