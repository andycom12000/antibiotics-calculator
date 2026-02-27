// State management
let selectedAntibiotics = new Set();    // Set of antibiotic names
let filteredAntibiotics = [];           // Array of API-format antibiotic objects
let allAntibiotics = [];                // Full list from API or data.js

// All pathogens with display names (used for coverage panel)
const ALL_PATHOGENS = {
    // Coverage pathogens (spectrum)
    'Strep': 'Streptococcus',
    'MSSA': 'MSSA',
    'Efc': 'E. faecalis',
    'Efm': 'E. faecium',
    'GNB': 'GNB (一般)',
    'Enbac': 'Enterobacter',
    'PsA': 'Pseudomonas',
    'Anae': '厭氧菌',
    'Atyp': 'Atypical',
    // Resistance pathogens
    'MRSA': 'MRSA',
    'ESBL': 'ESBL',
    'VRE': 'VRE',
    'MDRAB': 'MDRAB',
    'CRKP': 'CRKP'
};

// Category display order and UI class mapping
const CATEGORY_ORDER = {
    'penicillin': 1,
    'cephalosporin': 2,
    'carbapenem': 3,
    'fluoroquinolone': 4,
    'quinolone': 4,           // alias
    'glycopeptide': 5,
    'oxazolidinone': 6,
    'tetracycline': 7,
    'macrolide': 8,
    'lincosamide': 9,
    'polymyxin': 10,
    'aminoglycoside': 11,
    'other': 12
};

// Map API categories to CSS class names
function categoryToCssClass(category) {
    const mapping = {
        'penicillin': 'penicillin',
        'cephalosporin': 'cephalosporin',
        'carbapenem': 'carbapenem',
        'fluoroquinolone': 'quinolone',
        'glycopeptide': 'glycopeptide',
        'oxazolidinone': 'glycopeptide',  // similar color
        'tetracycline': 'other',
        'macrolide': 'other',
        'lincosamide': 'other',
        'polymyxin': 'other',
        'aminoglycoside': 'other',
        'other': 'other',
    };
    return mapping[category] || 'other';
}

document.addEventListener('DOMContentLoaded', async () => {
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

    // ─── Initialize data ─────────────────────────────────────

    // Show loading state
    resultsArea.innerHTML = '<div class="empty-state">載入中...</div>';

    allAntibiotics = await ApiClient.init();
    filteredAntibiotics = allAntibiotics;

    console.log(`[App] Loaded ${allAntibiotics.length} antibiotics (backend: ${ApiClient.isBackendAvailable})`);

    // ─── Event listeners ─────────────────────────────────────

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
        const collapsibleSections = document.querySelectorAll('.collapsible');
        const collapsedStates = Array.from(collapsibleSections).map(section =>
            section.classList.contains('collapsed')
        );

        document.querySelectorAll('.selection-section input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        selectedAntibiotics.clear();
        searchInput.value = '';
        selectedCountSpan.textContent = '尚未選擇';

        updateUI();

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
        multiselectHeader.setAttribute('aria-expanded', String(!isVisible));

        // Dynamic height: limit dropdown to available viewport space
        if (!isVisible) {
            const rect = multiselectDropdown.getBoundingClientRect();
            const availableHeight = window.innerHeight - rect.top - 16;
            multiselectDropdown.style.maxHeight = Math.max(150, availableHeight) + 'px';
        }
    });

    document.addEventListener('click', (e) => {
        if (!multiselectContainer.contains(e.target)) {
            multiselectDropdown.style.display = 'none';
            multiselectHeader.setAttribute('aria-expanded', 'false');
        }
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const options = multiselectOptions.querySelectorAll('.multiselect-option');
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    // Select all / deselect all
    const selectAllBtn = document.getElementById('select-all-btn');
    selectAllBtn.addEventListener('click', () => {
        const allSelected = filteredAntibiotics.length > 0 &&
            filteredAntibiotics.every(a => selectedAntibiotics.has(a.name));

        if (allSelected) {
            selectedAntibiotics.clear();
            selectAllBtn.textContent = '全選';
        } else {
            filteredAntibiotics.forEach(a => selectedAntibiotics.add(a.name));
            selectAllBtn.textContent = '取消全選';
        }

        multiselectOptions.querySelectorAll('.multiselect-option').forEach(option => {
            const checkbox = option.querySelector('input[type="checkbox"]');
            const label = option.querySelector('label');
            const name = label ? label.textContent : '';
            const isSelected = selectedAntibiotics.has(name);
            checkbox.checked = isSelected;
            option.classList.toggle('selected', isSelected);
        });

        updateSelectedCount();
        renderResults();
        updateSummary(calculateCrCl(), getSelectedCriteria());
        updateCoveragePanel();
    });

    // ─── Core functions ──────────────────────────────────────

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

    async function updateUI() {
        const crcl = calculateCrCl();
        const dialysisStatus = dialysisSelect.value;
        const crclDisplayBox = document.querySelector('.crcl-display');
        const crclLabel = crclDisplayBox.querySelector('.label');
        const crclUnit = crclDisplayBox.querySelector('.unit');

        if (dialysisStatus !== 'none') {
            crclDisplayBox.classList.add('dialysis-warning');
            crclLabel.textContent = '透析狀態:';
            crclDisplay.textContent = dialysisStatus;
            crclUnit.textContent = '';
        } else {
            crclDisplayBox.classList.remove('dialysis-warning');
            crclLabel.textContent = '預估 CrCl:';
            crclDisplay.textContent = crcl || '--';
            crclUnit.textContent = 'ml/min';
        }

        const criteria = getSelectedCriteria();

        // Separate pathogen criteria from penetration site criteria
        const penetrationSites = ['BBB', 'Bili', 'UTI'];
        const pathogenCriteria = criteria.filter(c => !penetrationSites.includes(c));
        const siteCriteria = criteria.filter(c => penetrationSites.includes(c));

        // Use API for pathogen filtering
        let results = await ApiClient.searchByCoverage(pathogenCriteria);

        // Client-side filter for penetration sites (not in API search)
        if (siteCriteria.length > 0) {
            results = results.filter(ab => {
                return siteCriteria.every(site => {
                    // Check penetration_sites array from API response
                    if (ab.penetration_sites && ab.penetration_sites.includes(site)) return true;
                    // Fallback: check legacy data
                    if (ab._legacy && ab._legacy.penetration && ab._legacy.penetration[site]) return true;
                    return false;
                });
            });
        }

        filteredAntibiotics = results;
        updateMultiselectOptions();
        renderResults();
        updateSummary(crcl, criteria);
        updateCoveragePanel();
    }

    function updateMultiselectOptions() {
        multiselectOptions.innerHTML = '';

        // Update filter count badge and hint text
        const filterCountBadge = document.getElementById('filter-count');
        const selectorHint = document.querySelector('.selector-hint');
        const criteria = getSelectedCriteria();
        const penetrationSites = ['BBB', 'Bili', 'UTI'];
        const pathogenCriteria = criteria.filter(c => !penetrationSites.includes(c));

        if (filterCountBadge) {
            if (criteria.length > 0) {
                filterCountBadge.textContent = `${filteredAntibiotics.length} 種`;
                filterCountBadge.style.display = 'inline-block';
            } else {
                filterCountBadge.textContent = '';
                filterCountBadge.style.display = 'none';
            }
        }

        if (selectorHint) {
            if (pathogenCriteria.length > 0) {
                selectorHint.childNodes[0].textContent = `符合 ${pathogenCriteria.join(', ')} 的抗生素（可多選）`;
            } else {
                selectorHint.childNodes[0].textContent = '從篩選結果中選擇要查看的抗生素（可多選）';
            }
        }

        if (filteredAntibiotics.length === 0) {
            multiselectOptions.innerHTML = '<div style="padding: 1rem; text-align: center; color: #64748b;">沒有符合條件的抗生素</div>';
            selectedAntibiotics.clear();
            updateSelectedCount();
            return;
        }

        // Remove selected antibiotics not in filtered list
        const filteredNames = new Set(filteredAntibiotics.map(a => a.name));
        for (const name of [...selectedAntibiotics]) {
            if (!filteredNames.has(name)) {
                selectedAntibiotics.delete(name);
            }
        }

        // Sort by category
        const sortedAntibiotics = [...filteredAntibiotics].sort((a, b) => {
            const orderA = CATEGORY_ORDER[a.category] || 99;
            const orderB = CATEGORY_ORDER[b.category] || 99;
            return orderA - orderB;
        });

        sortedAntibiotics.forEach(anti => {
            const cssClass = categoryToCssClass(anti.category);
            const option = document.createElement('div');
            option.className = `multiselect-option category-${cssClass}`;
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

            option.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== label) {
                    toggleSelection();
                }
            });

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleSelection();
            });

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
        updateSelectAllBtnText();
    }

    function updateSelectAllBtnText() {
        const btn = document.getElementById('select-all-btn');
        if (!btn) return;
        const allSelected = filteredAntibiotics.length > 0 &&
            filteredAntibiotics.every(a => selectedAntibiotics.has(a.name));
        btn.textContent = allSelected ? '取消全選' : '全選';
    }

    function updateSelectedCount() {
        const count = selectedAntibiotics.size;
        selectedCountSpan.textContent = count === 0 ? '尚未選擇' : `已選擇 ${count} 個抗生素`;
        updateSelectAllBtnText();
    }

    async function renderResults() {
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

        // Fetch full details for each selected antibiotic (regimens, notes, dialysis)
        const detailedAntibiotics = await Promise.all(
            antibioticsToShow.map(async (anti) => {
                if (anti.regimens) return anti; // already has detail
                if (anti.id && typeof ApiClient !== 'undefined') {
                    try {
                        const detail = await ApiClient.getAntibiotic(anti.id);
                        if (detail) return { ...anti, ...detail };
                    } catch {}
                }
                return anti;
            })
        );

        const dialysisStatus = dialysisSelect.value;

        resultsArea.innerHTML = detailedAntibiotics.map(anti => {
            const cssClass = categoryToCssClass(anti.category);

            // Get dosage and notes data
            const legacy = anti._legacy;
            const hasLegacy = !!legacy;

            // Collect dialysis dosages from regimens if not at top level
            const allDialysisDosages = anti.dialysis_dosages ||
                (anti.regimens || []).flatMap(r => r.dialysis_dosages || []);

            // Dosage section
            let dosageHTML = '';
            if (dialysisStatus === 'none') {
                if (anti.regimens && anti.regimens.length > 0) {
                    // API format: use regimens
                    dosageHTML = _renderRegimens(anti.regimens);
                } else if (hasLegacy && legacy.dosages && legacy.dosages.length > 0) {
                    // Fallback: data.js format
                    dosageHTML = `
                        <div class="dosage-section">
                            <h5>💊 建議劑量</h5>
                            ${legacy.dosages.map(d => `
                                <div class="dosage-item ${d.preferred ? 'preferred' : ''}">
                                    <span class="indication">${d.indication}</span>
                                    <span class="dose">${d.dose}</span>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            }

            // Dialysis section
            let dialysisHTML = '';
            if (dialysisStatus !== 'none') {
                if (allDialysisDosages.length > 0) {
                    // API format
                    const matching = allDialysisDosages.filter(d => d.dialysis_type === dialysisStatus);
                    if (matching.length > 0) {
                        dialysisHTML = `
                            <div class="dosage-section dialysis-dosage">
                                <h5>💊 透析劑量 (${dialysisStatus})</h5>
                                ${matching.map(d => `
                                    <div class="dosage-item preferred">
                                        <span class="indication">${d.dialysis_type}</span>
                                        <span class="dose">${d.dose_text}</span>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                } else if (hasLegacy && legacy.dialysisDosages && legacy.dialysisDosages[dialysisStatus]) {
                    // Fallback: data.js format
                    dialysisHTML = `
                        <div class="dosage-section dialysis-dosage">
                            <h5>💊 透析劑量 (${dialysisStatus})</h5>
                            <div class="dosage-item preferred">
                                <span class="indication">${dialysisStatus}</span>
                                <span class="dose">${legacy.dialysisDosages[dialysisStatus]}</span>
                            </div>
                        </div>
                    `;
                }
            }

            // Notes/Comments section
            let commentsHTML = '';
            if (anti.notes && anti.notes.length > 0) {
                // API format
                commentsHTML = `
                    <div class="comments-section">
                        <h5>📋 重要備註</h5>
                        ${anti.notes.map(n => `<p>${n.content}</p>`).join('')}
                    </div>
                `;
            } else if (hasLegacy && legacy.comments) {
                // Fallback: data.js format
                commentsHTML = `
                    <div class="comments-section">
                        <h5>📋 重要備註</h5>
                        <p>${legacy.comments}</p>
                    </div>
                `;
            }

            return `
                <div class="anti-card category-${cssClass}">
                    <h4>${anti.name}</h4>
                    ${dosageHTML}
                    ${dialysisHTML}
                    ${commentsHTML}
                </div>
            `;
        }).join('');
    }

    /**
     * Render regimens from API format with structured dosage display.
     */
    function _renderRegimens(regimens) {
        if (!regimens || regimens.length === 0) return '';

        const items = regimens.map(r => {
            const doseTexts = (r.dosage_values || []).map(dv => dv.dose_text).join(', ');
            const routeLabel = r.route || '';
            const indication = r.indication || '';
            const displayIndication = [routeLabel, indication].filter(Boolean).join(' - ');

            return `
                <div class="dosage-item ${r.is_preferred ? 'preferred' : ''}">
                    <span class="indication">${displayIndication}</span>
                    <span class="dose">${doseTexts || 'No data'}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="dosage-section">
                <h5>💊 建議劑量</h5>
                ${items}
            </div>
        `;
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
        if (ApiClient.isBackendAvailable) {
            text += `\n[API mode]`;
        }

        summaryText.textContent = text;
    }

    function updateCoveragePanel() {
        const coveredContainer = document.getElementById('covered-pathogens');
        const uncoveredContainer = document.getElementById('uncovered-pathogens');

        if (!coveredContainer || !uncoveredContainer) return;

        // Get selected antibiotic objects
        const selectedAntiList = filteredAntibiotics.filter(a => selectedAntibiotics.has(a.name));

        if (selectedAntiList.length === 0) {
            coveredContainer.innerHTML = '<p class="empty-hint">尚未選擇抗生素</p>';
            uncoveredContainer.innerHTML = '<p class="empty-hint">尚未選擇抗生素</p>';
            updateMobileCoverageSummary([], []);
            return;
        }

        // Determine relevant pathogens based on user's criteria
        const criteria = getSelectedCriteria();
        const penetrationSites = ['BBB', 'Bili', 'UTI'];
        const pathogenCriteria = criteria.filter(c => !penetrationSites.includes(c));

        // Only show pathogens the user selected; if none selected, show all
        const relevantPathogens = pathogenCriteria.length > 0
            ? new Set(pathogenCriteria.filter(c => ALL_PATHOGENS[c]))
            : new Set(Object.keys(ALL_PATHOGENS));

        // Calculate coverage using API data format
        const coverageMap = {};
        for (const pathogenKey of relevantPathogens) {
            coverageMap[pathogenKey] = { covered: false, level: '' };
        }

        // Track bonus coverage (pathogens not in criteria but covered by selected antibiotics)
        const bonusCoverage = {};

        for (const anti of selectedAntiList) {
            // API format: covered_pathogens is an array of codes
            if (anti.covered_pathogens) {
                for (const code of anti.covered_pathogens) {
                    if (coverageMap[code] !== undefined) {
                        coverageMap[code] = { covered: true, level: 'v' };
                    } else if (pathogenCriteria.length > 0 && ALL_PATHOGENS[code] && !relevantPathogens.has(code)) {
                        bonusCoverage[code] = { covered: true, level: 'v' };
                    }
                }
            }

            // Fallback: also check legacy coverage/resistance for detail levels
            if (anti._legacy) {
                const legacy = anti._legacy;
                if (legacy.coverage) {
                    for (const [pathogen, level] of Object.entries(legacy.coverage)) {
                        if (level && level !== '') {
                            if (coverageMap[pathogen] !== undefined) {
                                coverageMap[pathogen] = { covered: true, level };
                            } else if (pathogenCriteria.length > 0 && ALL_PATHOGENS[pathogen] && !relevantPathogens.has(pathogen)) {
                                bonusCoverage[pathogen] = { covered: true, level };
                            }
                        }
                    }
                }
                if (legacy.resistance) {
                    for (const [pathogen, level] of Object.entries(legacy.resistance)) {
                        if (level && level !== '') {
                            if (coverageMap[pathogen] !== undefined) {
                                coverageMap[pathogen] = { covered: true, level };
                            } else if (pathogenCriteria.length > 0 && ALL_PATHOGENS[pathogen] && !relevantPathogens.has(pathogen)) {
                                bonusCoverage[pathogen] = { covered: true, level };
                            }
                        }
                    }
                }
            }
        }

        // Separate into covered and uncovered (from relevant pathogens only)
        const covered = [];
        const uncovered = [];

        for (const key of relevantPathogens) {
            const displayName = ALL_PATHOGENS[key];
            if (coverageMap[key] && coverageMap[key].covered) {
                covered.push({ key, displayName, level: coverageMap[key].level });
            } else {
                uncovered.push({ key, displayName });
            }
        }

        // Add bonus coverage items
        for (const [key, info] of Object.entries(bonusCoverage)) {
            covered.push({ key, displayName: ALL_PATHOGENS[key], level: info.level, bonus: true });
        }

        if (covered.length > 0) {
            coveredContainer.innerHTML = covered.map(p => `
                <span class="pathogen-tag covered${p.bonus ? ' bonus' : ''}">
                    ${p.displayName}
                    ${p.level && p.level !== 'v' ? `<span class="coverage-level">${p.level}</span>` : ''}
                    ${p.bonus ? '<span class="coverage-level">bonus</span>' : ''}
                </span>
            `).join('');
        } else {
            coveredContainer.innerHTML = '<p class="empty-hint">無覆蓋病原菌</p>';
        }

        if (uncovered.length > 0) {
            uncoveredContainer.innerHTML = uncovered.map(p => `
                <span class="pathogen-tag uncovered">${p.displayName}</span>
            `).join('');
        } else {
            uncoveredContainer.innerHTML = '<p class="empty-hint">已覆蓋所有病原菌</p>';
        }

        updateMobileCoverageSummary(covered, uncovered);
    }

    function updateMobileCoverageSummary(covered, uncovered) {
        const container = document.getElementById('mobile-coverage-summary');
        const coveredEl = document.getElementById('mobile-covered');
        const uncoveredEl = document.getElementById('mobile-uncovered');
        if (!container || !coveredEl || !uncoveredEl) return;

        if (covered.length === 0 && uncovered.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        coveredEl.innerHTML = covered.map(p =>
            `<span class="pathogen-tag covered">${p.displayName}</span>`
        ).join('');
        uncoveredEl.innerHTML = uncovered.map(p =>
            `<span class="pathogen-tag uncovered">${p.displayName}</span>`
        ).join('');
    }

    // ─── Collapsible sections ────────────────────────────────

    document.querySelectorAll('.collapsible .section-header').forEach(header => {
        const toggleCollapse = () => {
            const section = header.closest('.collapsible');
            section.classList.toggle('collapsed');
            const isExpanded = !section.classList.contains('collapsed');
            header.setAttribute('aria-expanded', String(isExpanded));
        };
        header.addEventListener('click', toggleCollapse);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCollapse();
            }
        });
    });

    // ─── Initial render ──────────────────────────────────────
    updateUI();
});
