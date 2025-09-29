const CandidateEnrichmentService = class {
  constructor() {
    this.enrichedCache = new Map();
  }

  async enrichCandidate(candidate) {
    const key = candidate.linkedinUrl || candidate.linkedin_url || candidate.id;
    if (this.enrichedCache.has(key)) {
      return this.enrichedCache.get(key);
    }

    const enriched = {
      ...candidate,
      enrichedAt: new Date().toISOString(),
      yearsOfExperience: this.calculateExperience(candidate),
      industryCategory: this.categorizeIndustry(candidate),
      isFinancialAdvisor: this.checkIfFA(candidate),
      credentials: this.extractCredentials(candidate),
      licenses: this.extractLicenses(candidate),
      estimatedAUM: this.estimateAUM(candidate),
      estimatedClientCount: this.estimateClients(candidate),
      careerStage: this.determineCareerStage(candidate),
      jobSeekingSignals: this.identifySignals(candidate),
      matchScore: this.calculateMatchScore(candidate),
      fitAssessment: this.assessFit(candidate),
      riskFlags: this.identifyRisks(candidate),
      outreachPriority: this.calculatePriority(candidate)
    };

    this.enrichedCache.set(key, enriched);
    return enriched;
  }

  calculateExperience(candidate) {
    const expMatch = (candidate.snippet || '').match(/(\d+)\+?\s*years?/i);
    if (expMatch) return parseInt(expMatch[1]);
    const title = (candidate.title || '').toLowerCase();
    if (title.includes('senior')) return 7;
    if (title.includes('lead')) return 5;
    if (title.includes('junior')) return 2;
    return 3;
  }

  categorizeIndustry(candidate) {
    const title = (candidate.title || '').toLowerCase();
    const company = (candidate.company || '').toLowerCase();
    if (title.includes('financial advisor') || title.includes('wealth')) return 'Financial Advisory';
    if (company.includes('bank') || title.includes('banker')) return 'Banking';
    if (company.includes('insurance') || title.includes('insurance')) return 'Insurance';
    if (title.includes('investment') || title.includes('portfolio')) return 'Investment Management';
    return 'Other Finance';
  }

  checkIfFA(candidate) {
    const text = `${candidate.title || ''} ${candidate.company || ''}`.toLowerCase();
    return ['financial advisor','financial adviser','wealth manager','financial planner','wealth advisor'].some(k => text.includes(k));
  }

  extractCredentials(candidate) {
    const text = `${candidate.title || ''} ${candidate.snippet || ''}`;
    return ['CFP','ChFC','CLU','CFA','CIMA','CPWA','CEPA','CASL','CAP','RICP','WMCP','AAMS','CRPC','CRPS']
      .filter(cred => new RegExp(`\\b${cred}\\b`, 'i').test(text));
  }

  extractLicenses(candidate) {
    const text = `${candidate.title || ''} ${candidate.snippet || ''}`.toLowerCase();
    const licenses = [];
    if (text.includes('series 7') || text.includes('s7')) licenses.push('Series 7');
    if (text.includes('series 66') || text.includes('s66')) licenses.push('Series 66');
    if (text.includes('series 63') || text.includes('s63')) licenses.push('Series 63');
    if (text.includes('series 65') || text.includes('s65')) licenses.push('Series 65');
    if (text.includes('insurance') || text.includes('life')) licenses.push('Life Insurance');
    return licenses;
  }

  estimateAUM(candidate) {
    const aumMatch = (candidate.snippet || '').match(/\$(\d+)([MmBb])/);
    if (aumMatch) {
      const value = parseInt(aumMatch[1], 10);
      const multiplier = aumMatch[2].toLowerCase() === 'b' ? 1000 : 1;
      return value * multiplier;
    }
    const years = this.calculateExperience(candidate);
    return (candidate.title || '').toLowerCase().includes('senior') ? years * 10 : years * 5; // in $M
  }

  estimateClients(candidate) {
    const aum = this.estimateAUM(candidate);
    return Math.round((aum * 1_000_000) / 300_000);
  }

  determineCareerStage(candidate) {
    const years = this.calculateExperience(candidate);
    if (years >= 10) return 'Senior';
    if (years >= 5) return 'Experienced';
    if (years >= 2) return 'Developing';
    return 'Entry';
  }

  identifySignals(candidate) {
    const signals = [];
    const text = (candidate.snippet || '').toLowerCase();
    if (text.includes('seeking') || text.includes('open to')) signals.push({ type: 'Actively Looking', strength: 'high' });
    if (text.includes('connect') || text.includes('network')) signals.push({ type: 'Open to Networking', strength: 'medium' });
    return signals;
  }

  calculateMatchScore(candidate) {
    let score = 0;
    if (this.checkIfFA(candidate)) score += 30;
    score += Math.min(this.calculateExperience(candidate) * 2, 20);
    score += Math.min(this.extractCredentials(candidate).length * 5, 15);
    score += Math.min(this.extractLicenses(candidate).length * 5, 15);
    if ((candidate.location_text || '').toLowerCase().includes('milwaukee')) score += 10;
    score += Math.min(this.identifySignals(candidate).length * 5, 10);
    return Math.min(score, 100);
  }

  assessFit(candidate) {
    const score = this.calculateMatchScore(candidate);
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Moderate';
    return 'Low';
  }

  identifyRisks(candidate) {
    const risks = [];
    if ((candidate.company || '').toLowerCase().includes('morgan stanley') || (candidate.company || '').toLowerCase().includes('merrill')) {
      risks.push({ type: 'Likely Non-Compete', level: 'yellow' });
    }
    return risks;
  }

  calculatePriority(candidate) {
    const score = this.calculateMatchScore(candidate);
    const hasSignals = this.identifySignals(candidate).length > 0;
    if (score >= 80 && hasSignals) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  }
};

module.exports = new CandidateEnrichmentService();


