(() => {
  const api = new APIClient();

  const el = (id) => document.getElementById(id);
  const container = {
    stats: { candidatesWithScores: 'stat-candidates-with-scores', avgScore: 'stat-avg-score' },
    search: { title: 'src-title', location: 'src-location', button: 'src-search-btn', results: 'src-results' },
    seekers: { list: 'active-seekers', minScore: 'min-score', refresh: 'refresh-seekers-btn' },
    saved: { list: 'saved-candidates' },
    scanSignalsBtn: 'scan-signals-btn',
  };

  async function fetchStats() {
    try {
      const data = await api.get('/sourcing/signals/stats');
      if (data && data.summary) {
        el(container.stats.candidatesWithScores).textContent = data.summary.candidates_with_scores || 0;
        const avg = Number(data.summary.avg_score || 0);
        el(container.stats.avgScore).textContent = (avg).toFixed(2);
      }
    } catch (e) {
      console.error('Failed to load sourcing stats', e);
    }
  }

  async function fetchActiveSeekers() {
    try {
      const min = parseFloat(el(container.seekers.minScore).value || '0.5');
      const res = await fetch(`window.API_BASE_URL || ''/api/sourcing/active-seekers?min_score=${min}`);
      const data = await res.json();
      const seekers = (data.candidates || data.seekers || []).map((s) => ({
        id: s.id || s.candidate_id,
        name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        email: s.email,
        title: s.title || s.current_title,
        company: s.company || s.current_company,
        score: s.job_seeking_score || s.avg_signal_strength || 0,
        signals: s.signals || s.signal_types || [],
        linkedin_url: s.linkedin_url || s.profile_url,
      }));

      const list = el(container.seekers.list);
      list.innerHTML = seekers.length === 0 ? '<p style="color:#6b7280;">No active seekers.</p>' : seekers.map(renderSeeker).join('');
    } catch (e) {
      console.error('Failed to load active seekers', e);
    }
  }

  function renderSeeker(c) {
    const scorePct = typeof c.score === 'number' ? Math.round(c.score * (c.score <= 1 ? 100 : 1)) : 0;
    const signals = Array.isArray(c.signals) ? c.signals : [];
    return `
      <div class="candidate-card">
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <div class="candidate-info" style="flex:1;">
            <div class="candidate-name">${c.name || 'Unknown'}</div>
            <div class="candidate-email">${c.title || ''} ${c.company ? '• ' + c.company : ''}</div>
            <div class="candidate-email">${c.email || ''}</div>
          </div>
          <div><span class="score-badge">${scorePct}%</span></div>
        </div>
        <div class="candidate-progress" style="margin-top:6px;">
          ${signals && signals.length ? signals.map(s => `<span class="meta-tag">${typeof s === 'string' ? s : s.type}</span>`).join('') : ''}
        </div>
        ${c.linkedin_url ? `<div style="margin-top:8px; display:flex; justify-content:flex-end;"><a class="btn outline" href="${c.linkedin_url}" target="_blank">LinkedIn</a></div>` : ''}
      </div>
    `;
  }

  async function searchLinkedIn() {
    const title = el(container.search.title).value.trim();
    const location = el(container.search.location).value.trim();
    if (!title) return;

    try {
      const data = await api.post('/sourcing/search/linkedin', { title, location, limit: 10 });
      const results = data.candidates || [];
      const html = results.map((c, idx) => `
        <div class="candidate-card">
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <div class="candidate-info" style="flex:1;">
              <div class="candidate-name">${c.name || 'Unknown'}</div>
              <div class="candidate-email">${c.title || ''} ${c.company ? '• ' + c.company : ''}</div>
            </div>
            <div><span class="score-badge">${c.score || 0}</span></div>
          </div>
          <div class="candidate-progress" style="margin-top:6px;">
            <button data-i="${idx}" class="btn save-src-btn">Save</button>
            ${c.linkedin_url ? `<a class="btn outline" href="${c.linkedin_url}" target="_blank">Profile</a>` : ''}
          </div>
        </div>
      `).join('');
      const resultsEl = el(container.search.results);
      resultsEl.innerHTML = results.length ? html : '<p style="color:#6b7280;">No results.</p>';

      // Attach save handlers
      resultsEl.querySelectorAll('.save-src-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const i = parseInt(e.currentTarget.getAttribute('data-i'));
          const cand = results[i];
          try {
            await api.post('/sourcing/candidates/sourced', cand);
            await loadSavedCandidates();
            alert('Saved');
          } catch (err) {
            alert('Save failed');
          }
        });
      });
    } catch (e) {
      console.error('Search failed', e);
    }
  }

  async function loadSavedCandidates() {
    try {
      const data = await api.get('/sourcing/candidates/sourced');
      const saved = data.candidates || [];
      const list = el(container.saved.list);
      list.innerHTML = saved.length === 0 ? '<p style="color:#6b7280;">No saved candidates.</p>' : saved.map((c) => `
        <div class="candidate-card">
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <div class="candidate-info" style="flex:1;">
              <div class="candidate-name">${c.name}</div>
              <div class="candidate-email">${c.title || ''} ${c.company ? '• ' + c.company : ''}</div>
            </div>
            ${c.score ? `<div><span class=\"score-badge\">${c.score}</span></div>` : ''}
          </div>
          ${c.linkedin_url ? `<div style=\"margin-top:8px; display:flex; justify-content:flex-end;\"><a class=\"btn outline\" href=\"${c.linkedin_url}\" target=\"_blank\">LinkedIn</a></div>` : ''}
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to load saved candidates', e);
    }
  }

  async function scanSignals() {
    try {
      await api.post('/sourcing/scan-signals', {});
      await fetchStats();
      await fetchActiveSeekers();
      alert('Signals scan triggered');
    } catch (e) {
      console.error('Scan signals failed', e);
    }
  }

  function wireUp() {
    const searchBtn = el(container.search.button);
    if (searchBtn) searchBtn.addEventListener('click', searchLinkedIn);

    const refreshSeekers = el(container.seekers.refresh);
    if (refreshSeekers) refreshSeekers.addEventListener('click', fetchActiveSeekers);

    const scanBtn = el(container.scanSignalsBtn);
    if (scanBtn) scanBtn.addEventListener('click', scanSignals);

    // Tag chips -> fill title and trigger search
    document.querySelectorAll('#sourcing-view .tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const titleInput = el(container.search.title);
        if (titleInput) {
          titleInput.value = chip.textContent.trim();
          // Focus and search
          titleInput.focus();
          if (searchBtn) searchBtn.click();
        }
      });
    });
  }

  window.searchLinkedIn = searchLinkedIn; // expose for premium loader
  window.scanSignals = scanSignals;

  window.addEventListener('viewChanged', (evt) => {
    if (evt.detail?.view === 'sourcing') {
      fetchStats();
      fetchActiveSeekers();
      loadSavedCandidates();
    }
  });

  document.addEventListener('DOMContentLoaded', () => { wireUp(); });
})();


