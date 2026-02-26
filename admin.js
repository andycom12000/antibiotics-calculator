/**
 * Admin UI for Antibiotic Calculator
 */
const Admin = (() => {
    const BASE_URL = 'http://localhost:8000';
    let antibiotics = [];
    let pathogens = [];
    let penetrationSites = [];

    // ─── Init ────────────────────────────────────────────────

    async function init() {
        setupNavigation();
        setupModal();
        await checkApi();
        await loadReferenceData();
        await loadAntibiotics();
        setupAntibioticsSection();
        setupCoverageSection();
        setupDosageSection();
        await loadEmpiricSection();
        await loadInstitutionsSection();
    }

    async function checkApi() {
        const statusEl = document.getElementById('api-status');
        try {
            const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
            if (res.ok) {
                statusEl.innerHTML = '<span class="status-dot online"></span><span>API 已連線</span>';
                return true;
            }
        } catch {}
        statusEl.innerHTML = '<span class="status-dot offline"></span><span>API 未連線</span>';
        return false;
    }

    async function loadReferenceData() {
        try {
            const [pRes, sRes] = await Promise.all([
                fetch(`${BASE_URL}/api/pathogens`),
                fetch(`${BASE_URL}/api/penetration-sites`),
            ]);
            if (pRes.ok) pathogens = await pRes.json();
            if (sRes.ok) penetrationSites = await sRes.json();
        } catch {
            console.warn('[Admin] Could not load reference data');
        }
    }

    // ─── Navigation ──────────────────────────────────────────

    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const section = item.dataset.section;
                document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
                document.getElementById(`section-${section}`).classList.add('active');
            });
        });
    }

    // ─── Modal ───────────────────────────────────────────────

    function setupModal() {
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
    }

    function openModal(title, bodyHTML, footerHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-footer').innerHTML = footerHTML;
        document.getElementById('modal-overlay').style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
    }

    function toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    // ─── API Helpers ─────────────────────────────────────────

    async function api(path, options = {}) {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
        if (options.method === 'DELETE' && res.status === 204) return null;
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || 'API error');
        }
        return res.json();
    }

    // ═══════════════════════════════════════════════════════════
    // ANTIBIOTICS SECTION
    // ═══════════════════════════════════════════════════════════

    async function loadAntibiotics() {
        try {
            antibiotics = await api('/api/antibiotics');
        } catch {
            antibiotics = [];
        }
        renderAntibioticTable();
        populateAntibioticSelects();
    }

    function renderAntibioticTable(filter = '') {
        const tbody = document.getElementById('ab-tbody');
        const filtered = filter
            ? antibiotics.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()))
            : antibiotics;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">無資料</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(ab => `
            <tr>
                <td>${ab.id}</td>
                <td><strong>${ab.name}</strong></td>
                <td><span class="category-badge">${ab.category}</span></td>
                <td><span class="agent-badge ${ab.agent_type}">${ab.agent_type}</span></td>
                <td>${ab.generation || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="Admin.editAntibiotic(${ab.id})">編輯</button>
                    <button class="btn btn-danger btn-sm" onclick="Admin.deleteAntibiotic(${ab.id}, '${ab.name.replace(/'/g, "\\'")}')">刪除</button>
                </td>
            </tr>
        `).join('');
    }

    function setupAntibioticsSection() {
        document.getElementById('ab-search').addEventListener('input', (e) => {
            renderAntibioticTable(e.target.value);
        });
        document.getElementById('btn-add-ab').addEventListener('click', () => showAntibioticForm());
    }

    function showAntibioticForm(ab = null) {
        const isEdit = !!ab;
        const categories = ['penicillin','cephalosporin','carbapenem','fluoroquinolone','glycopeptide','oxazolidinone','tetracycline','macrolide','lincosamide','polymyxin','aminoglycoside','other'];
        const agentTypes = ['antibacterial','antifungal','antiviral'];

        const body = `
            <div class="form-group">
                <label>名稱 *</label>
                <input class="form-input" id="form-ab-name" value="${ab?.name || ''}" placeholder="e.g. Meropenem">
            </div>
            <div class="form-group">
                <label>學名</label>
                <input class="form-input" id="form-ab-generic" value="${ab?.generic_name || ''}" placeholder="e.g. Meropenem trihydrate">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>分類 *</label>
                    <select class="form-select" id="form-ab-category">
                        ${categories.map(c => `<option value="${c}" ${ab?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>類型 *</label>
                    <select class="form-select" id="form-ab-agent">
                        ${agentTypes.map(t => `<option value="${t}" ${ab?.agent_type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>世代</label>
                <input class="form-input" id="form-ab-gen" value="${ab?.generation || ''}" placeholder="e.g. 3°">
            </div>
            <div class="form-group">
                <label>醫生備註</label>
                <textarea class="form-textarea" id="form-ab-doc-notes">${ab?.notes_for_doctor || ''}</textarea>
            </div>
            <div class="form-group">
                <label>護士備註</label>
                <textarea class="form-textarea" id="form-ab-nurse-notes">${ab?.notes_for_nurse || ''}</textarea>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Admin.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="Admin.saveAntibiotic(${ab?.id || 'null'})">${isEdit ? '更新' : '新增'}</button>
        `;

        openModal(isEdit ? '編輯抗生素' : '新增抗生素', body, footer);
    }

    async function editAntibiotic(id) {
        try {
            const ab = await api(`/api/antibiotics/${id}`);
            showAntibioticForm(ab);
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function saveAntibiotic(id) {
        const data = {
            name: document.getElementById('form-ab-name').value.trim(),
            generic_name: document.getElementById('form-ab-generic').value.trim() || null,
            category: document.getElementById('form-ab-category').value,
            agent_type: document.getElementById('form-ab-agent').value,
            generation: document.getElementById('form-ab-gen').value.trim() || null,
            notes_for_doctor: document.getElementById('form-ab-doc-notes').value.trim() || null,
            notes_for_nurse: document.getElementById('form-ab-nurse-notes').value.trim() || null,
        };

        if (!data.name) { toast('名稱為必填', 'error'); return; }

        try {
            if (id) {
                await api(`/api/antibiotics/${id}`, { method: 'PUT', body: JSON.stringify(data) });
                toast('抗生素已更新');
            } else {
                await api('/api/antibiotics', { method: 'POST', body: JSON.stringify(data) });
                toast('抗生素已新增');
            }
            closeModal();
            await loadAntibiotics();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function deleteAntibiotic(id, name) {
        const footer = `
            <button class="btn btn-secondary" onclick="Admin.closeModal()">取消</button>
            <button class="btn btn-danger" onclick="Admin.confirmDeleteAntibiotic(${id})">確認刪除</button>
        `;
        openModal('確認刪除', `<p>確定要刪除 <strong>${name}</strong> 嗎？此操作無法復原。</p>`, footer);
    }

    async function confirmDeleteAntibiotic(id) {
        try {
            await api(`/api/antibiotics/${id}`, { method: 'DELETE' });
            toast('抗生素已刪除');
            closeModal();
            await loadAntibiotics();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════════════
    // COVERAGE MATRIX SECTION
    // ═══════════════════════════════════════════════════════════

    function populateAntibioticSelects() {
        const selects = ['coverage-ab-select', 'dosage-ab-select'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const currentVal = el.value;
            el.innerHTML = '<option value="">選擇抗生素...</option>' +
                antibiotics.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
            el.value = currentVal;
        });
    }

    function setupCoverageSection() {
        document.getElementById('coverage-ab-select').addEventListener('change', async (e) => {
            const abId = e.target.value;
            if (!abId) {
                document.getElementById('coverage-editor').innerHTML = '<p class="hint">請先選擇一個抗生素來編輯其抗菌譜覆蓋範圍。</p>';
                return;
            }
            await renderCoverageEditor(parseInt(abId));
        });
    }

    async function renderCoverageEditor(abId) {
        const editor = document.getElementById('coverage-editor');
        try {
            const ab = await api(`/api/antibiotics/${abId}`);
            const coveredSet = new Set(ab.coverages.filter(c => c.is_covered).map(c => c.pathogen_code));
            const penSet = new Set(ab.penetrations.map(p => p.site_code));

            let html = `<h3 style="margin-bottom:1rem;">${ab.name} — 病原體覆蓋</h3>`;
            html += '<div class="coverage-grid">';
            for (const p of pathogens) {
                const checked = coveredSet.has(p.code) ? 'checked' : '';
                const covClass = checked ? 'covered' : '';
                html += `
                    <label class="coverage-item ${covClass}">
                        <input type="checkbox" data-pathogen="${p.code}" ${checked}>
                        <div>
                            <div class="pathogen-label">${p.code}</div>
                            <div class="pathogen-type">${p.name} (${p.pathogen_type})</div>
                        </div>
                    </label>
                `;
            }
            html += '</div>';

            // Penetration sites
            html += '<div class="penetration-section"><h4>組織滲透位點</h4><div class="coverage-grid">';
            for (const s of penetrationSites) {
                const checked = penSet.has(s.code) ? 'checked' : '';
                html += `
                    <label class="coverage-item ${checked ? 'covered' : ''}">
                        <input type="checkbox" data-site="${s.code}" ${checked}>
                        <div>
                            <div class="pathogen-label">${s.code}</div>
                            <div class="pathogen-type">${s.name}</div>
                        </div>
                    </label>
                `;
            }
            html += '</div></div>';

            html += `<p style="margin-top:1rem;color:#94a3b8;font-size:0.8rem;">
                覆蓋矩陣的修改需要透過 API 直接操作（即將支援直接儲存）。
            </p>`;

            editor.innerHTML = html;
        } catch (err) {
            editor.innerHTML = `<p class="hint">無法載入資料: ${err.message}</p>`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // DOSAGE SECTION
    // ═══════════════════════════════════════════════════════════

    function setupDosageSection() {
        document.getElementById('dosage-ab-select').addEventListener('change', async (e) => {
            const abId = e.target.value;
            if (!abId) {
                document.getElementById('dosage-editor').innerHTML = '<p class="hint">請先選擇一個抗生素來管理其劑量方案。</p>';
                return;
            }
            await renderDosageEditor(parseInt(abId));
        });
    }

    async function renderDosageEditor(abId) {
        const editor = document.getElementById('dosage-editor');
        try {
            const ab = await api(`/api/antibiotics/${abId}`);

            let html = `<h3 style="margin-bottom:1rem;">${ab.name} — 劑量方案</h3>`;

            if (ab.regimens && ab.regimens.length > 0) {
                for (const r of ab.regimens) {
                    const preferredClass = r.is_preferred ? 'preferred' : '';
                    html += `
                        <div class="regimen-card ${preferredClass}">
                            <div class="regimen-header">
                                <span class="regimen-title">${r.route} — ${r.indication || 'standard'}</span>
                                <div>
                                    ${r.is_preferred ? '<span class="meta-tag preferred">首選</span>' : ''}
                                    ${r.is_weight_based ? '<span class="meta-tag">依體重</span>' : ''}
                                </div>
                            </div>
                            <div class="regimen-meta">
                                ${r.dose_descriptor ? `<span class="meta-tag">${r.dose_descriptor}</span>` : ''}
                                ${r.fixed_duration ? `<span class="meta-tag">療程: ${r.fixed_duration}</span>` : ''}
                            </div>
                    `;

                    // Dosage values
                    if (r.dosage_values && r.dosage_values.length > 0) {
                        for (const dv of r.dosage_values) {
                            html += `<div class="dosage-text"><strong>${dv.crcl_range_label}:</strong> ${dv.dose_text}</div>`;
                        }
                    }

                    // Dialysis dosages
                    if (r.dialysis_dosages && r.dialysis_dosages.length > 0) {
                        html += '<div class="dialysis-list">';
                        for (const dd of r.dialysis_dosages) {
                            html += `<div class="dialysis-item"><strong>${dd.dialysis_type}:</strong> ${dd.dose_text}</div>`;
                        }
                        html += '</div>';
                    }

                    // Notes
                    if (r.notes_for_doctor) {
                        html += `<div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b;">醫: ${r.notes_for_doctor}</div>`;
                    }

                    html += '</div>';
                }
            } else {
                html += '<p class="hint">此抗生素尚無劑量方案資料。</p>';
            }

            // Antibiotic-level notes
            if (ab.notes && ab.notes.length > 0) {
                html += '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e2e8f0;">';
                html += '<h4 style="font-size:0.9rem;color:#64748b;margin-bottom:0.5rem;">抗生素備註</h4>';
                for (const n of ab.notes) {
                    html += `<div class="dosage-text">[${n.note_type}] ${n.content}</div>`;
                }
                html += '</div>';
            }

            editor.innerHTML = html;
        } catch (err) {
            editor.innerHTML = `<p class="hint">無法載入資料: ${err.message}</p>`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EMPIRIC SECTION
    // ═══════════════════════════════════════════════════════════

    async function loadEmpiricSection() {
        const container = document.getElementById('empiric-list');
        try {
            const syndromes = await api('/api/empiric');
            if (syndromes.length === 0) {
                container.innerHTML = '<p class="hint">尚無經驗治療資料。</p>';
                return;
            }

            container.innerHTML = syndromes.map(s => `
                <div class="admin-card">
                    <h4>${s.name}</h4>
                    <div class="recommendation-list">
                        ${s.recommendations.map(r => `
                            <div class="rec-item">
                                <span class="tier-badge ${r.tier}">${r.tier}</span>
                                <span>${r.antibiotic_name}</span>
                                ${r.is_addon ? '<span class="meta-tag">加用</span>' : ''}
                                ${r.addon_notes ? `<span style="color:#94a3b8;font-size:0.75rem;">(${r.addon_notes})</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-danger btn-sm" onclick="Admin.deleteSyndrome(${s.id}, '${s.name.replace(/'/g, "\\'")}')">刪除</button>
                    </div>
                </div>
            `).join('');
        } catch {
            container.innerHTML = '<p class="hint">無法載入經驗治療資料（API 未連線）。</p>';
        }

        document.getElementById('btn-add-syndrome').addEventListener('click', () => {
            const body = `
                <div class="form-group">
                    <label>症候群名稱 *</label>
                    <input class="form-input" id="form-syndrome-name" placeholder="e.g. Biliary Tract Infections">
                </div>
            `;
            const footer = `
                <button class="btn btn-secondary" onclick="Admin.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="Admin.saveSyndrome()">新增</button>
            `;
            openModal('新增經驗治療症候群', body, footer);
        });
    }

    async function saveSyndrome() {
        const name = document.getElementById('form-syndrome-name').value.trim();
        if (!name) { toast('名稱為必填', 'error'); return; }
        try {
            await api('/api/empiric', { method: 'POST', body: JSON.stringify({ name }) });
            toast('症候群已新增');
            closeModal();
            await loadEmpiricSection();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function deleteSyndrome(id, name) {
        const footer = `
            <button class="btn btn-secondary" onclick="Admin.closeModal()">取消</button>
            <button class="btn btn-danger" onclick="Admin.confirmDeleteSyndrome(${id})">確認刪除</button>
        `;
        openModal('確認刪除', `<p>確定要刪除 <strong>${name}</strong> 及其所有推薦用藥嗎？</p>`, footer);
    }

    async function confirmDeleteSyndrome(id) {
        try {
            await api(`/api/empiric/${id}`, { method: 'DELETE' });
            toast('症候群已刪除');
            closeModal();
            await loadEmpiricSection();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════════════
    // INSTITUTIONS SECTION
    // ═══════════════════════════════════════════════════════════

    async function loadInstitutionsSection() {
        const container = document.getElementById('institution-list');
        try {
            const institutions = await api('/api/institutions');
            if (institutions.length === 0) {
                container.innerHTML = '<p class="hint">尚無機構資料。</p>';
                return;
            }
            container.innerHTML = institutions.map(inst => `
                <div class="admin-card">
                    <h4>${inst.name} <span style="color:#94a3b8;font-weight:normal;">(${inst.code})</span></h4>
                    <p style="font-size:0.85rem;color:#64748b;">覆蓋率覆寫: ${inst.override_count} 筆</p>
                    <div class="card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="Admin.viewInstitution(${inst.id})">查看覆寫</button>
                        <button class="btn btn-danger btn-sm" onclick="Admin.deleteInstitution(${inst.id}, '${inst.name.replace(/'/g, "\\'")}')">刪除</button>
                    </div>
                </div>
            `).join('');
        } catch {
            container.innerHTML = '<p class="hint">無法載入機構資料（API 未連線）。</p>';
        }

        document.getElementById('btn-add-inst').addEventListener('click', () => {
            const body = `
                <div class="form-group">
                    <label>機構名稱 *</label>
                    <input class="form-input" id="form-inst-name" placeholder="e.g. 台北市立聯合醫院">
                </div>
                <div class="form-group">
                    <label>機構代碼 *</label>
                    <input class="form-input" id="form-inst-code" placeholder="e.g. TPECH">
                </div>
            `;
            const footer = `
                <button class="btn btn-secondary" onclick="Admin.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="Admin.saveInstitution()">新增</button>
            `;
            openModal('新增機構', body, footer);
        });
    }

    async function saveInstitution() {
        const name = document.getElementById('form-inst-name').value.trim();
        const code = document.getElementById('form-inst-code').value.trim();
        if (!name || !code) { toast('名稱和代碼為必填', 'error'); return; }
        try {
            await api('/api/institutions', { method: 'POST', body: JSON.stringify({ name, code }) });
            toast('機構已新增');
            closeModal();
            await loadInstitutionsSection();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function viewInstitution(id) {
        try {
            const inst = await api(`/api/institutions/${id}`);
            let body = `<h4>${inst.name}</h4>`;
            if (inst.overrides && inst.overrides.length > 0) {
                body += '<table class="data-table" style="margin-top:1rem;"><thead><tr><th>抗生素</th><th>病原體</th><th>覆蓋</th></tr></thead><tbody>';
                for (const o of inst.overrides) {
                    body += `<tr><td>${o.antibiotic_name}</td><td>${o.pathogen_code}</td><td>${o.is_covered ? '✓' : '✗'}</td></tr>`;
                }
                body += '</tbody></table>';
            } else {
                body += '<p class="hint" style="padding:1rem;">此機構尚無覆蓋率覆寫。</p>';
            }
            openModal(`${inst.name} — 覆蓋率覆寫`, body, '<button class="btn btn-secondary" onclick="Admin.closeModal()">關閉</button>');
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function deleteInstitution(id, name) {
        const footer = `
            <button class="btn btn-secondary" onclick="Admin.closeModal()">取消</button>
            <button class="btn btn-danger" onclick="Admin.confirmDeleteInstitution(${id})">確認刪除</button>
        `;
        openModal('確認刪除', `<p>確定要刪除 <strong>${name}</strong> 嗎？</p>`, footer);
    }

    async function confirmDeleteInstitution(id) {
        try {
            await api(`/api/institutions/${id}`, { method: 'DELETE' });
            toast('機構已刪除');
            closeModal();
            await loadInstitutionsSection();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    // ─── Public API ──────────────────────────────────────────

    return {
        init,
        closeModal,
        editAntibiotic,
        saveAntibiotic,
        deleteAntibiotic,
        confirmDeleteAntibiotic,
        saveSyndrome,
        deleteSyndrome,
        confirmDeleteSyndrome,
        saveInstitution,
        viewInstitution,
        deleteInstitution,
        confirmDeleteInstitution,
    };
})();

document.addEventListener('DOMContentLoaded', () => Admin.init());
