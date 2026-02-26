/**
 * API Client for Antibiotic Calculator Backend
 *
 * Provides all API calls with graceful fallback to data.js when backend
 * is unavailable (offline mode / development without backend).
 */
const ApiClient = (() => {
    const BASE_URL = 'http://localhost:8000';
    let _backendAvailable = false;
    let _cachedAntibiotics = null; // API format cache
    let _cachedPathogens = null;

    // ─── Backend Detection ───────────────────────────────────

    async function checkBackend() {
        try {
            const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
            _backendAvailable = res.ok;
        } catch {
            _backendAvailable = false;
        }
        console.log(`[ApiClient] Backend ${_backendAvailable ? 'available' : 'unavailable (using data.js fallback)'}`);
        return _backendAvailable;
    }

    // ─── Data Transformation (data.js → API format) ─────────

    /**
     * Convert a data.js antibiotic object to the API response format.
     */
    function _transformLegacy(ab, index) {
        return {
            id: index + 1,
            name: ab.name,
            generic_name: null,
            category: _detectCategory(ab.name),
            agent_type: _detectAgentType(ab.name),
            generation: _detectGeneration(ab.name),
            covered_pathogens: [
                ...Object.entries(ab.coverage || {}).filter(([, v]) => v && v !== '').map(([k]) => k),
                ...Object.entries(ab.resistance || {}).filter(([, v]) => v && v !== '').map(([k]) => k),
            ],
            penetration_sites: Object.entries(ab.penetration || {}).filter(([, v]) => v).map(([k]) => k),
            // Keep original data for rendering
            _legacy: ab,
        };
    }

    function _detectCategory(name) {
        const n = name.toLowerCase();
        if (n.includes('cillin') || n.includes('amox') || n.includes('unasyn') || n.includes('tazocin')) return 'penicillin';
        if (n.includes('cef') || n.includes('flomoxef') || n.includes('brosym') || n.includes('zavicefta')) return 'cephalosporin';
        if (n.includes('penem') || n.includes('culin') || n.includes('doripenem')) return 'carbapenem';
        if (n.includes('floxacin') || n.includes('nemonoxacin')) return 'fluoroquinolone';
        if (n.includes('vancomycin') || n.includes('teicoplanin')) return 'glycopeptide';
        if (n.includes('linezolid')) return 'oxazolidinone';
        if (n.includes('minocycline') || n.includes('tigecycline')) return 'tetracycline';
        if (n.includes('erythromycin') || n.includes('azithromycin')) return 'macrolide';
        if (n.includes('clindamycin')) return 'lincosamide';
        if (n.includes('colistin') || n.includes('polymyxin') || n.includes('bobimixyn')) return 'polymyxin';
        if (n.includes('amikacin')) return 'aminoglycoside';
        if (n.includes('daptomycin')) return 'glycopeptide';
        return 'other';
    }

    function _detectAgentType(name) {
        const n = name.toLowerCase();
        if (['fluconazole', 'voriconazole', 'flucytosine', 'anidulafungin', 'eraxis', 'isavuconazole', 'amphotericin'].some(k => n.includes(k))) return 'antifungal';
        if (['acyclovir', 'ganciclovir', 'peramivir', 'rapiacta'].some(k => n.includes(k))) return 'antiviral';
        return 'antibacterial';
    }

    function _detectGeneration(name) {
        const m = name.match(/\((\d)°\)/);
        return m ? `${m[1]}°` : null;
    }

    // ─── Public API ──────────────────────────────────────────

    /**
     * Initialize: check backend, load initial data.
     * Returns the full antibiotic list in unified format.
     */
    async function init() {
        await checkBackend();
        return getAllAntibiotics();
    }

    /**
     * Get all antibiotics (with coverage summary).
     */
    async function getAllAntibiotics() {
        if (_cachedAntibiotics) return _cachedAntibiotics;

        if (_backendAvailable) {
            try {
                const res = await fetch(`${BASE_URL}/api/antibiotics/search/by-coverage`);
                _cachedAntibiotics = await res.json();
                return _cachedAntibiotics;
            } catch (err) {
                console.warn('[ApiClient] API call failed, falling back to data.js:', err);
            }
        }

        // Fallback: transform data.js
        if (typeof ANTIBIOTICS !== 'undefined') {
            _cachedAntibiotics = ANTIBIOTICS.map(_transformLegacy);
            return _cachedAntibiotics;
        }

        return [];
    }

    /**
     * Search antibiotics by pathogen coverage.
     * @param {string[]} pathogenCodes - e.g. ['MRSA', 'ESBL']
     */
    async function searchByCoverage(pathogenCodes) {
        if (pathogenCodes.length === 0) return getAllAntibiotics();

        if (_backendAvailable) {
            try {
                const params = pathogenCodes.map(p => `pathogens=${encodeURIComponent(p)}`).join('&');
                const res = await fetch(`${BASE_URL}/api/antibiotics/search/by-coverage?${params}`);
                return await res.json();
            } catch (err) {
                console.warn('[ApiClient] Search API failed, falling back:', err);
            }
        }

        // Fallback: client-side filtering on data.js
        const all = await getAllAntibiotics();
        return all.filter(ab => {
            return pathogenCodes.every(code => ab.covered_pathogens.includes(code));
        });
    }

    /**
     * Get full antibiotic detail (with regimens, dosages, notes).
     * @param {number} id
     */
    async function getAntibiotic(id) {
        if (_backendAvailable) {
            try {
                const res = await fetch(`${BASE_URL}/api/antibiotics/${id}`);
                if (res.ok) return await res.json();
            } catch (err) {
                console.warn('[ApiClient] Detail API failed:', err);
            }
        }

        // Fallback: find in data.js by index
        if (typeof ANTIBIOTICS !== 'undefined' && id > 0 && id <= ANTIBIOTICS.length) {
            const ab = ANTIBIOTICS[id - 1];
            return {
                ..._transformLegacy(ab, id - 1),
                regimens: (ab.dosages || []).map((d, i) => ({
                    id: i,
                    route: _parseRoute(d.indication),
                    indication: _parseIndication(d.indication),
                    is_preferred: d.preferred || false,
                    sort_order: i,
                    dosage_values: [{ crcl_range_label: 'Normal', dose_text: d.dose }],
                    dialysis_dosages: [],
                })),
                dialysis_dosages_legacy: ab.dialysisDosages || {},
                notes: ab.comments ? [{ id: 1, note_type: 'general', content: ab.comments }] : [],
            };
        }

        return null;
    }

    /**
     * Get dosage for a specific CrCl or dialysis mode.
     */
    async function getDosage(antibioticId, crcl, dialysis) {
        if (_backendAvailable) {
            try {
                const params = new URLSearchParams();
                if (dialysis) params.set('dialysis', dialysis);
                else if (crcl != null) params.set('crcl', crcl);
                const res = await fetch(`${BASE_URL}/api/antibiotics/${antibioticId}/dosage?${params}`);
                if (res.ok) return await res.json();
            } catch (err) {
                console.warn('[ApiClient] Dosage API failed:', err);
            }
        }
        return null;
    }

    /**
     * Get all pathogens.
     */
    async function getPathogens() {
        if (_cachedPathogens) return _cachedPathogens;

        if (_backendAvailable) {
            try {
                const res = await fetch(`${BASE_URL}/api/pathogens`);
                _cachedPathogens = await res.json();
                return _cachedPathogens;
            } catch (err) {
                console.warn('[ApiClient] Pathogens API failed:', err);
            }
        }

        // Fallback: hardcoded from data.js knowledge
        return null;
    }

    function _parseRoute(indication) {
        if (!indication) return 'IV';
        const u = indication.toUpperCase();
        if (u.includes('IV/PO') || u.includes('PO/IV')) return 'IV/PO';
        if (u.includes('IV/IM')) return 'IV/IM';
        if (u.includes('IV')) return 'IV';
        if (u.includes('PO')) return 'PO';
        if (u.includes('IM')) return 'IM';
        return 'IV';
    }

    function _parseIndication(indication) {
        if (!indication) return 'standard';
        return indication.replace(/^(IV\/PO|PO\/IV|IV\/IM|IV|PO|IM|INHL)\s*/, '').replace(/^\(/, '').replace(/\)$/, '').trim() || 'standard';
    }

    /**
     * Invalidate cache (after mutations).
     */
    function invalidateCache() {
        _cachedAntibiotics = null;
        _cachedPathogens = null;
    }

    return {
        init,
        checkBackend,
        getAllAntibiotics,
        searchByCoverage,
        getAntibiotic,
        getDosage,
        getPathogens,
        invalidateCache,
        get isBackendAvailable() { return _backendAvailable; },
    };
})();
