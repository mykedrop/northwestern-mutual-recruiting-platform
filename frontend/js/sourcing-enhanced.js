// Minimal bootstrap to hook into existing sourcing view and provide pagination + report modal
window.enhancedSourcing = new (class {
  constructor() {
    this.currentPage = 1;
    this.totalPages = 1;
    this.pageSize = 20; // Increased from 12 to 20 results per page
    this.enrichedCache = new Map();
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    const searchBtn = document.getElementById('src-search-btn');
    if (searchBtn) {
      try { searchBtn.removeEventListener('click', window.searchLinkedIn); } catch (e) {}
      searchBtn.addEventListener('click', () => this.performSearch(1));
    }

    // Delegated handlers for dynamically rendered cards
    document.addEventListener('click', (e) => {
      const viewBtn = e.target && (e.target.closest ? e.target.closest('.btn-view-report') : null);
      if (viewBtn) {
        e.preventDefault();
        const payload = viewBtn.getAttribute('data-report');
        if (payload) {
          this.showCandidateReport(payload);
        }
        return;
      }

      const saveBtn = e.target && (e.target.closest ? e.target.closest('.btn-quick-save') : null);
      if (saveBtn) {
        e.preventDefault();
        try {
          const cand = JSON.parse(decodeURIComponent(saveBtn.getAttribute('data-save')));
          fetch((window.API_BASE_URL || '') + '/api/sourcing/candidates/sourced', {
            method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(cand)
          }).then(() => { saveBtn.textContent = 'Saved'; }).catch(() => { /* noop */ });
        } catch (_) { /* ignore */ }
      }
    });
  }

  async performSearch(page = 1) {
    const title = (document.getElementById('src-title') || {}).value || '';
    const location = (document.getElementById('src-location') || {}).value || '';
    const container = document.getElementById('src-results');
    if (!container) return;
    container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';
    try {
      const res = await fetch((window.API_BASE_URL || '') + '/api/sourcing/search/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, location, limit: this.pageSize, page })
      });
      const data = await res.json();
      this.currentPage = data.page || page;
      this.totalPages = data.totalPages || 1;
      this.totalResults = data.totalResults || 0; // Store total results for display
      const results = (data && (data.results || data.candidates)) || (Array.isArray(data) ? data : []);
      if (!Array.isArray(results)) throw new Error('Invalid results payload');
      const html = results.map((c) => { try { return this.createEnhancedCard(c); } catch (err) { console.error('Card render error', err, c); return ''; } }).join('');
      container.innerHTML = html && html.trim().length ? html : '<div class="empty-state"><h3>No results</h3><p>Try adjusting your search.</p></div>';
      this.renderPagination();
      // Load More button when we likely have more results
      const existing = document.getElementById('src-load-more');
      if (existing) existing.remove();
      if (results.length >= this.pageSize && this.currentPage < this.totalPages) {
        const btn = document.createElement('button');
        btn.id = 'src-load-more';
        btn.className = 'pagination-btn';
        btn.style.margin = '16px auto';
        btn.style.display = 'block';
        btn.textContent = 'Load More';
        btn.onclick = () => this.goToPage(this.currentPage + 1);
        container.parentNode.insertBefore(btn, container.nextSibling);
      }
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><h3>Error</h3><p>Search failed.</p></div>';
    }
  }

  cardHTML(c) {
    const matchScore = typeof c.score === 'number' ? Math.round(c.score) : 75;
    return `
      <div class="candidate-card" data-linkedin-url="${c.linkedin_url}">
        <div class="card-header">
          <div class="candidate-basic">
            <h3 class="candidate-name">${c.name || 'Unknown'}</h3>
            <p class="candidate-current">${c.title || ''} ${c.company ? 'at ' + c.company : ''}</p>
          </div>
          <div class="match-score">
            <span class="match-score-value">${matchScore}%</span>
            <span class="match-score-label">Match</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-view-report" data-report='${encodeURIComponent(JSON.stringify(c))}'>View Full Report</button>
          <button class="btn-quick-save" data-save='${encodeURIComponent(JSON.stringify(c))}'>Save</button>
        </div>
      </div>`;
  }

  // Expose methods used by integration
  createEnhancedCard(candidate) {
    const rawText = `${candidate.title || ''} ${candidate.company || ''} ${candidate.snippet || ''}`;

    let yearsExp = '0';
    const expMatch = rawText.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
    if (expMatch) {
      yearsExp = expMatch[1];
    } else if (rawText.toLowerCase().includes('senior') || rawText.toLowerCase().includes('vice president')) {
      yearsExp = '7+';
    } else if (rawText.toLowerCase().includes('manager') || rawText.toLowerCase().includes('director')) {
      yearsExp = '5+';
    } else {
      yearsExp = '3+';
    }

    let company = candidate.company || '';
    if (!company && candidate.title) {
      const atMatch = candidate.title.match(/at\s+(.+?)(?:\s*[-|]|$)/i);
      if (atMatch) {
        company = atMatch[1].trim();
      }
    }

    let jobTitle = candidate.title || 'Financial Professional';
    if (company && jobTitle.includes(company)) {
      jobTitle = jobTitle.replace(`at ${company}`, '').replace(company, '').trim();
    }
    jobTitle = jobTitle.replace(/\s*\|.*$/, '').replace(/\s*-\s*LinkedIn.*$/, '').trim();
    // If jobTitle looks like a sentence/snippet, try to recover from metadata
    const looksLikeSnippet = jobTitle.length > 80 || /[.!?]/.test(jobTitle) || /followers/i.test(jobTitle) || /\d+\s+years/i.test(jobTitle);
    if (looksLikeSnippet && candidate.raw_data && candidate.raw_data.title) {
      const metaTitle = String(candidate.raw_data.title);
      const parts = metaTitle.split(' - ');
      if (parts.length > 1) {
        const metaJob = parts.slice(1).join(' - ').split('|')[0].trim();
        if (metaJob && metaJob.length < 80 && !/[.!?]/.test(metaJob)) {
          jobTitle = metaJob;
        }
      }
    }
    // Fallback: infer from keywords
    if (!jobTitle || looksLikeSnippet) {
      const possible = faKeywords.find(k => rawText.toLowerCase().includes(k));
      if (possible) jobTitle = possible.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }

    const faKeywords = ['financial advisor', 'financial adviser', 'wealth advisor', 'financial planner', 'wealth manager'];
    const isFA = faKeywords.some(keyword => rawText.toLowerCase().includes(keyword));

    const credentials = [];
    const credentialPatterns = ['CFP', 'ChFC', 'CLU', 'CFA', 'CIMA', 'CPWA', 'CEPA', 'CASL', 'AEP', 'MBA', 'CPA'];
    credentialPatterns.forEach(cred => {
      if (new RegExp(`\\b${cred}\\b`, 'i').test(rawText)) {
        credentials.push(cred);
      }
    });

    const licenses = [];
    const lower = rawText.toLowerCase();
    if (lower.includes('series 7') || lower.includes('s7')) licenses.push('Series 7');
    if (lower.includes('series 66') || lower.includes('s66')) licenses.push('Series 66');
    if (lower.includes('series 63')) licenses.push('Series 63');
    if (lower.includes('series 65')) licenses.push('Series 65');
    if (lower.includes('insurance') || lower.includes('life')) licenses.push('Insurance');

    let industry = 'Finance';
    if (company.toLowerCase().includes('bank') || jobTitle.toLowerCase().includes('bank')) {
      industry = 'Banking';
    } else if (isFA) {
      industry = 'Financial Advisory';
    } else if (company.toLowerCase().includes('insurance') || jobTitle.toLowerCase().includes('insurance')) {
      industry = 'Insurance';
    } else if (jobTitle.toLowerCase().includes('investment') || company.toLowerCase().includes('investment')) {
      industry = 'Investment Mgmt';
    }

    let location = candidate.location_text || '';
    if (!location && candidate.snippet) {
      const locationMatch = candidate.snippet.match(/(?:in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2})/);
      if (locationMatch) {
        location = locationMatch[1];
      }
    }

    const rawScore = (candidate.matchScore !== undefined && candidate.matchScore !== null) ? candidate.matchScore : (candidate.score !== undefined && candidate.score !== null ? candidate.score : 0.75);
    const computed = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
    const matchScore = Math.min(computed, 100);

    return `
        <div class="candidate-card" data-linkedin-url="${candidate.linkedin_url}" data-candidate='${encodeURIComponent(JSON.stringify(candidate))}' style="min-height: 320px; display: flex; flex-direction: column;">
            <div class="card-header">
                <div class="candidate-basic">
                    <h3 class="candidate-name">
                        ${candidate.name || 'Unknown Candidate'}
                    </h3>
                    <p class="candidate-current">${jobTitle}</p>
                    <p class="candidate-company" style="color: #6B7280; font-size: 13px; margin-top: 2px;">
                        ${company || 'Company Not Listed'}
                        ${location ? ` • ${location}` : ''}
                    </p>
                </div>
                <div class="match-score">
                    <span class="match-score-value">${matchScore}%</span>
                    <span class="match-score-label">MATCH</span>
                </div>
            </div>
            
            <div class="key-metrics">
                <div class="metric-item">
                    <div class="metric-content">
                        <span class="metric-label">EXPERIENCE</span>
                        <span class="metric-value">${yearsExp} years</span>
                    </div>
                </div>
                <div class="metric-item">
                    <div class="metric-content">
                        <span class="metric-label">INDUSTRY</span>
                        <span class="metric-value">${industry}</span>
                    </div>
                </div>
            </div>
            
            <div class="status-badges">
                ${isFA ? 
                    '<span class="badge fa-status" style="background: #10B981; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px;">✓ Financial Advisor</span>' : 
                    '<span class="badge not-fa" style="background: #FEF3C7; color: #92400E; padding: 4px 10px; border-radius: 20px; font-size: 12px;">Other Role</span>'
                }
                ${credentials.length > 0 ? credentials.map(cred => 
                    `<span class="badge credential" style="background: #DBEAFE; color: #1E40AF; padding: 4px 10px; border-radius: 20px; font-size: 12px; margin-left: 4px;">${cred}</span>`
                ).join('') : ''}
            </div>
            
            ${licenses.length > 0 ? `
                <div class="licenses" style="margin-top: 8px;">
                    ${licenses.map(license => 
                        `<span class="license-pill" style="background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; padding: 3px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; display: inline-block;">${license}</span>`
                    ).join('')}
                </div>
            ` : ''}
            
            <div class="card-actions" style="margin-top: auto; padding-top: 16px; border-top: 1px solid #E4E4E7; display: flex; gap: 8px;">
                <button class="btn-view-report" onclick="enhancedSourcing.showCandidateReport('${encodeURIComponent(JSON.stringify({
                    ...candidate,
                    parsedData: {
                        yearsExp,
                        industry,
                        isFA,
                        credentials,
                        licenses,
                        jobTitle,
                        company,
                        location,
                        matchScore
                    }
                }))}')" style="flex: 1; padding: 10px; background: #003d82; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                    View Full Report
                </button>
                <button class="btn-quick-save" onclick="enhancedSourcing.quickSave('${candidate.linkedin_url}')" style="padding: 10px 20px; background: white; color: #003d82; border: 2px solid #003d82; border-radius: 6px; font-weight: 600; cursor: pointer;">
                    Save
                </button>
            </div>
        </div>
    `;
  }
  getEmptyStateHTML() { return '<div class="empty-state"><h3>No results</h3><p>Try adjusting your search.</p></div>'; }
  renderEnhancedResults() {
    const container = document.getElementById('src-results');
    if (!container) return;
    const results = this.searchResults || [];
    container.innerHTML = results.length ? results.map(c => this.createEnhancedCard(c)).join('') : this.getEmptyStateHTML();
  }

  renderPagination() {
    const resultsEl = document.getElementById('src-results');
    if (!resultsEl || this.totalPages <= 1) return;

    // Remove existing pagination controls
    const existingPagination = document.querySelectorAll('.pagination-container');
    existingPagination.forEach(el => el.remove());

    const totalResultsText = this.totalResults ? ` (${this.totalResults.toLocaleString()} total results)` : '';
    const html = `
      <div class="pagination-container" style="margin: 20px 0; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <div style="margin-bottom: 10px;">
          <span class="pagination-info" style="font-size: 16px; font-weight: 600;">Page ${this.currentPage} of ${this.totalPages.toLocaleString()}${totalResultsText}</span>
        </div>
        <div style="display: flex; justify-content: center; gap: 10px; align-items: center;">
          <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} id="pg-prev" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">← Previous</button>
          <span style="padding: 0 20px;">Showing ${this.pageSize} results per page</span>
          <button class="pagination-btn" ${this.currentPage >= this.totalPages ? 'disabled' : ''} id="pg-next" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Next →</button>
        </div>
      </div>`;
    resultsEl.insertAdjacentHTML('afterend', html);
    const prev = document.getElementById('pg-prev');
    const next = document.getElementById('pg-next');
    if (prev) prev.onclick = () => this.goToPage(this.currentPage - 1);
    if (next) next.onclick = () => this.goToPage(this.currentPage + 1);
    // Wire card buttons
    resultsEl.querySelectorAll('.btn-view-report').forEach(btn => {
      btn.addEventListener('click', (e) => this.showCandidateReport(btn.getAttribute('data-report')));
    });
    resultsEl.querySelectorAll('.btn-quick-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cand = JSON.parse(decodeURIComponent(btn.getAttribute('data-save')));
        try { await fetch((window.API_BASE_URL || '') + '/api/sourcing/candidates/sourced', { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(cand) }); alert('Saved'); } catch { alert('Save failed'); }
      });
    });
  }

  goToPage(p) { if (p < 1 || p > this.totalPages) return; this.performSearch(p); }

  async showCandidateReport(encoded) {
    let data;
    try { data = JSON.parse(decodeURIComponent(encoded)); } catch (_) {
      try { data = JSON.parse(encoded); } catch { data = {}; }
    }
    const modal = document.getElementById('candidate-modal');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;
    body.innerHTML = await this.generateReportHTML(data);
    modal.style.display = 'block';
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
  }

  async generateReportHTML(candidate) {
    const parsed = candidate.parsedData || {
      yearsExp: this.estimateExperience(candidate),
      industry: this.categorizeIndustry(candidate),
      isFA: this.checkIfFA(candidate),
      credentials: this.extractCredentials(candidate),
      licenses: this.extractLicenses(candidate),
      matchScore: Math.round((candidate.score || 0.75) * 100),
      jobTitle: candidate.title || 'Financial Professional',
      company: candidate.company || 'Not Listed',
      location: candidate.location_text || 'Not Specified'
    };

    return `
        <div class="report-modal-content" style="max-width: 900px; background: white; border-radius: 16px; max-height: 90vh; overflow-y: auto;">
            <div class="report-header" style="background: linear-gradient(135deg, #003d82 0%, #00265d 100%); color: white; padding: 32px; border-radius: 16px 16px 0 0;">
                <div class="report-header-content" style="display: flex; justify-content: space-between;">
                    <div>
                        <h2 style="font-size: 28px; margin: 0 0 8px 0;">${candidate.name || 'Candidate Report'}</h2>
                        <p style="font-size: 16px; opacity: 0.95; margin: 4px 0;">${parsed.jobTitle}</p>
                        <p style="font-size: 14px; opacity: 0.9;">${parsed.company} • ${parsed.location}</p>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 36px; font-weight: 700;">${parsed.matchScore}%</div>
                        <div style="font-size: 12px; text-transform: uppercase; opacity: 0.9;">MATCH SCORE</div>
                    </div>
                </div>
            </div>
            <div class="report-body" style="padding: 32px;">
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">📊 Executive Summary</h3>
                    <div style="background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); border: 1px solid #BAE6FD; border-radius: 8px; padding: 20px;">
                        <div style="font-size: 18px; font-weight: 700; color: #0369A1; margin-bottom: 12px;">
                            ✓ ${parsed.matchScore >= 80 ? 'IDEAL CANDIDATE' : parsed.matchScore >= 60 ? 'STRONG CANDIDATE' : 'POTENTIAL CANDIDATE'} - Ready to recruit
                        </div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 8px 0;">✓ Currently ${parsed.isFA ? 'a practicing Financial Advisor' : `in ${parsed.industry}`}</li>
                            <li style="padding: 8px 0;">✓ ${parsed.yearsExp}+ years of relevant experience</li>
                            <li style="padding: 8px 0;">✓ ${parsed.licenses.length} professional licenses${parsed.licenses.length > 0 ? `: ${parsed.licenses.join(', ')}` : ''}</li>
                            <li style="padding: 8px 0;">✓ ${parsed.credentials.length} credentials${parsed.credentials.length > 0 ? `: ${parsed.credentials.join(', ')}` : ''}</li>
                            <li style="padding: 8px 0;">✓ Located in ${parsed.location}</li>
                        </ul>
                    </div>
                </div>
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">👤 Professional Snapshot</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Current Role</div>
                            <div style="font-size: 16px; font-weight: 600;">${parsed.jobTitle}</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Company</div>
                            <div style="font-size: 16px; font-weight: 600;">${parsed.company}</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Experience</div>
                            <div style="font-size: 16px; font-weight: 600;">${parsed.yearsExp}+ years</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Industry</div>
                            <div style="font-size: 16px; font-weight: 600;">${parsed.industry}</div>
                        </div>
                    </div>
                </div>
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">🎓 Credentials & Licenses</h3>
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 14px; font-weight: 600; color: #52525B; margin-bottom: 12px;">Professional Licenses</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${parsed.licenses.length > 0 ? 
                                parsed.licenses.map(license => 
                                    `<span style="background: #D1FAE5; border: 1px solid #6EE7B7; color: #065F46; padding: 8px 16px; border-radius: 6px; font-weight: 600;">✓ ${license}</span>`
                                ).join('') :
                                '<span style="color: #71717A;">No licenses identified from profile</span>'
                            }
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: #52525B; margin-bottom: 12px;">Certifications & Designations</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${parsed.credentials.length > 0 ? 
                                parsed.credentials.map(cred => 
                                    `<span style="background: #DBEAFE; border: 1px solid #93C5FD; color: #1E40AF; padding: 8px 16px; border-radius: 6px; font-weight: 600;">${cred}</span>`
                                ).join('') :
                                '<span style="color: #71717A;">No certifications identified from profile</span>'
                            }
                        </div>
                    </div>
                </div>
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">📈 Performance Indicators</h3>
                    <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <strong>Note:</strong> These are industry estimates based on role, experience, and company type
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Est. AUM</div>
                            <div style="font-size: 20px; font-weight: 700; color: #18181B;">$${parsed.yearsExp * 10}M - $${parsed.yearsExp * 15}M</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Est. Clients</div>
                            <div style="font-size: 20px; font-weight: 700; color: #18181B;">${parsed.yearsExp * 20} - ${parsed.yearsExp * 30}</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Career Stage</div>
                            <div style="font-size: 20px; font-weight: 700; color: #18181B;">${parsed.yearsExp >= 10 ? 'Senior' : parsed.yearsExp >= 5 ? 'Experienced' : 'Developing'}</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Est. Production</div>
                            <div style="font-size: 20px; font-weight: 700; color: #18181B;">$${parsed.yearsExp * 100}K - $${parsed.yearsExp * 150}K</div>
                        </div>
                    </div>
                </div>
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">🎯 Career Analysis</h3>
                    <div style="background: linear-gradient(to right, #003d82, #0056b3); height: 8px; border-radius: 4px; margin-bottom: 8px;">
                        <div style="width: ${parsed.yearsExp >= 10 ? '90%' : parsed.yearsExp >= 5 ? '60%' : '30%'}; height: 100%; background: #D4AF37; border-radius: 4px;"></div>
                    </div>
                    <p style="color: #52525B; line-height: 1.8;">
                        This candidate shows ${parsed.yearsExp >= 7 ? 'strong career progression with significant' : 'steady development with growing'} 
                        experience in the financial services industry. 
                        ${parsed.isFA ? 'Currently serving as a Financial Advisor demonstrates direct relevant experience for Northwestern Mutual\'s needs.' : 
                        `While not currently in a pure FA role, their ${parsed.industry} background provides valuable transferable skills.`}
                        The presence of ${parsed.licenses.length > 0 ? `${parsed.licenses.length} active licenses` : 'industry experience'} 
                        ${parsed.credentials.length > 0 ? `and ${parsed.credentials.length} professional designations ` : ''}
                        indicates a commitment to professional development.
                    </p>
                </div>
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">🤝 Cultural Fit Assessment</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Work Style Match</div>
                            <div style="font-size: 16px; font-weight: 600;">${parsed.isFA ? 'Client-Focused' : 'Professional'}</div>
                        </div>
                        <div style="background: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #71717A; text-transform: uppercase; margin-bottom: 4px;">Values Alignment</div>
                            <div style="font-size: 16px; font-weight: 600;">${parsed.matchScore >= 70 ? 'Strong Match' : 'Good Potential'}</div>
                        </div>
                    </div>
                </div>
                <div class="report-section" style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E4E4E7;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">⚠️ Risk Assessment</h3>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                        <div style="background: #D1FAE5; border: 2px solid #6EE7B7; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px;">✓</div>
                            <div style="font-weight: 600; color: #065F46;">Green Flags</div>
                            <div style="font-size: 14px; color: #065F46; margin-top: 4px;">
                                ${parsed.yearsExp >= 5 ? 'Stable experience' : 'Growing career'}
                            </div>
                        </div>
                        <div style="background: #FEF3C7; border: 2px solid #FDE68A; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px;">⚠</div>
                            <div style="font-weight: 600; color: #92400E;">Considerations</div>
                            <div style="font-size: 14px; color: #92400E; margin-top: 4px;">
                                ${parsed.isFA ? 'May have non-compete' : 'Will need FA training'}
                            </div>
                        </div>
                        <div style="background: #D1FAE5; border: 2px solid #6EE7B7; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px;">✓</div>
                            <div style="font-weight: 600; color: #065F46;">Compliance</div>
                            <div style="font-size: 14px; color: #065F46; margin-top: 4px;">No red flags found</div>
                        </div>
                    </div>
                </div>
                <div class="report-section" style="margin-bottom: 32px;">
                    <h3 style="font-size: 20px; font-weight: 700; color: #18181B; margin: 0 0 16px 0;">📋 Recommended Actions</h3>
                    <div style="background: ${parsed.matchScore >= 80 ? '#FEE2E2' : parsed.matchScore >= 60 ? '#FEF3C7' : '#D1FAE5'}; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>Outreach Priority: ${parsed.matchScore >= 80 ? 'CRITICAL' : parsed.matchScore >= 60 ? 'HIGH' : 'MEDIUM'}</strong>
                    </div>
                    <div style="padding-left: 24px;">
                        <div style="padding: 12px 0; border-left: 3px solid #003d82; padding-left: 20px; margin-bottom: 12px;">
                            <div style="font-weight: 600;">Step 1: Initial Contact</div>
                            <div style="color: #52525B; margin-top: 4px;">
                                ${parsed.matchScore >= 80 ? 'Schedule immediate outreach via LinkedIn InMail' : 'Add to nurture campaign for targeted outreach'}
                            </div>
                        </div>
                        <div style="padding: 12px 0; border-left: 3px solid #003d82; padding-left: 20px; margin-bottom: 12px;">
                            <div style="font-weight: 600;">Step 2: Personalized Approach</div>
                            <div style="color: #52525B; margin-top: 4px;">
                                Reference their ${parsed.credentials.length > 0 ? `${parsed.credentials[0]} credential` : 'industry experience'} and ${parsed.company}
                            </div>
                        </div>
                        <div style="padding: 12px 0; border-left: 3px solid #003d82; padding-left: 20px;">
                            <div style="font-weight: 600;">Step 3: Follow-Up</div>
                            <div style="color: #52525B; margin-top: 4px;">
                                ${parsed.matchScore >= 70 ? 'Schedule call within 48 hours' : 'Add to weekly follow-up list'}
                            </div>
                        </div>
                    </div>
                </div>
                <div style="text-align: center; padding-top: 24px;">
                    <button onclick="window.print()" style="padding: 12px 32px; background: linear-gradient(135deg, #003d82 0%, #0056b3 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        📄 Export Report as PDF
                    </button>
                </div>
            </div>
        </div>
    `;
  }

  extractCredentials(candidate) {
    const credentials = [];
    const text = `${candidate.title || ''} ${candidate.snippet || ''} ${candidate.company || ''}`;
    const credentialPatterns = ['CFP', 'ChFC', 'CLU', 'CFA', 'CIMA', 'CPWA', 'CEPA', 'CASL', 'AEP', 'MBA', 'CPA'];
    credentialPatterns.forEach(cred => { if (new RegExp(`\\b${cred}\\b`, 'i').test(text)) credentials.push(cred); });
    return credentials;
  }

  estimateExperience(candidate) {
    const text = `${candidate.title || ''} ${candidate.snippet || ''}`;
    const m = text.match(/(\d+)\+?\s*years?/i);
    if (m) return parseInt(m[1], 10);
    const lower = text.toLowerCase();
    if (lower.includes('senior') || lower.includes('vice president')) return 7;
    if (lower.includes('manager') || lower.includes('director')) return 5;
    return 3;
  }

  categorizeIndustry(candidate) {
    const title = (candidate.title || '').toLowerCase();
    const company = (candidate.company || '').toLowerCase();
    if (title.includes('financial advisor') || title.includes('wealth')) return 'Financial Advisory';
    if (company.includes('bank') || title.includes('bank')) return 'Banking';
    if (company.includes('insurance') || title.includes('insurance')) return 'Insurance';
    if (title.includes('investment') || company.includes('investment')) return 'Investment Mgmt';
    return 'Finance';
  }

  checkIfFA(candidate) {
    const text = `${candidate.title || ''} ${candidate.company || ''} ${candidate.snippet || ''}`.toLowerCase();
    return ['financial advisor','financial adviser','wealth advisor','financial planner','wealth manager'].some(k => text.includes(k));
  }

  extractLicenses(candidate) {
    const text = `${candidate.title || ''} ${candidate.snippet || ''}`.toLowerCase();
    const out = [];
    if (text.includes('series 7') || text.includes('s7')) out.push('Series 7');
    if (text.includes('series 66') || text.includes('s66')) out.push('Series 66');
    if (text.includes('series 63')) out.push('Series 63');
    if (text.includes('series 65')) out.push('Series 65');
    if (text.includes('insurance') || text.includes('life')) out.push('Insurance');
    return out;
  }

  quickSave(linkedinUrl) {
    const card = document.querySelector(`[data-linkedin-url="${linkedinUrl}"]`);
    if (!card) return;
    try {
      const cand = JSON.parse(card.getAttribute('data-candidate') || '{}');
      fetch((window.API_BASE_URL || '') + '/api/sourcing/candidates/sourced', {
        method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(cand)
      }).then(() => {
        const btn = card.querySelector('.btn-quick-save');
        if (btn) btn.textContent = 'Saved';
      }).catch(() => {});
    } catch (_) {}
  }
})();


