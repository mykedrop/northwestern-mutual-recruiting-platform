const axios = require('axios');
const cheerio = require('cheerio');

class LinkedInSearchService {
  constructor() {
    this.cseId = process.env.GOOGLE_CSE_ID;
    this.apiKey = process.env.GOOGLE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
  }

  // Build LinkedIn X-ray search query
  buildQuery(params) {
    const {
      title = 'financial advisor',
      location = 'milwaukee',
      company = null,
      excludeCompany = 'northwestern mutual',
      keywords = [],
      broad = false
    } = params;

    // Broad query (no site: restriction) for better recall when CSE is sparse
    if (broad || process.env.CSE_BROAD_QUERY === 'true') {
      const parts = [];
      if (title) parts.push(`"${title}"`);
      if (location) parts.push(`"${location}"`);
      parts.push('linkedin');
      parts.push('professional profile');
      if (keywords.length) parts.push(...keywords);
      return parts.join(' ').trim();
    }

    // Default LinkedIn X-ray
    let query = 'site:linkedin.com/in';
    if (title) query += ` ${title}`;
    if (location) query += ` ${location}`;
    if (company) query += ` "${company}"`;
    if (excludeCompany) query += ` -"${excludeCompany}"`;
    if (keywords.length) query += ` ${keywords.join(' ')}`;
    return query;
  }

  // Search LinkedIn profiles via Google CSE
  async searchProfiles(params, startIndex = 1, num = 10) {
    try {
      const query = this.buildQuery(params);
      console.log('Searching with query:', query);
      
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          cx: this.cseId,
          q: query,
          start: startIndex,
          // Google CSE allows up to 10 per request
          num: Math.min(Number(num) || 10, 10)
        }
      });

      return {
        totalResults: response.data.searchInformation?.totalResults || 0,
        items: response.data.items || [],
        nextPage: response.data.queries?.nextPage?.[0] || null
      };
    } catch (error) {
      console.error('LinkedIn search error:', error.message);
      throw error;
    }
  }

  // Parse profile data from search result
  parseSearchResult(item) {
    const { title, link, snippet, pagemap } = item;
    
    // Extract name from title (usually "Name - Title | LinkedIn")
    const nameParts = title.split(' - ')[0].split(' | ')[0];
    
    // Extract profile data from pagemap metadata
    const metatags = pagemap?.metatags?.[0] || {};
    const profileImage = metatags['og:image'] || pagemap?.cse_image?.[0]?.src;
    
    return {
      name: nameParts,
      title: this.extractTitle(snippet, title),
      company: this.extractCompany(snippet),
      location: this.extractLocation(snippet),
      linkedin_url: link,
      profile_image: profileImage,
      snippet: snippet,
      raw_data: item
    };
  }

  // Extract title from snippet or page title
  extractTitle(snippet, pageTitle) {
    // Try to extract from snippet first
    const parts = snippet.split(' · ');
    if (parts[0] && !parts[0].includes('Experience:')) {
      return parts[0];
    }
    
    // Fall back to page title
    const titleParts = pageTitle.split(' - ');
    if (titleParts.length > 1) {
      return titleParts[1].split(' | ')[0];
    }
    
    return null;
  }

  // Extract company from snippet
  extractCompany(snippet) {
    // Look for "Experience: Company" pattern
    const expMatch = snippet.match(/Experience: ([^·]+)/);
    if (expMatch) return expMatch[1].trim();
    
    // Try standard format
    const parts = snippet.split(' · ');
    if (parts.length > 1) {
      return parts[1]?.split(' · ')[0]?.trim() || null;
    }
    return null;
  }

  // Extract location from snippet
  extractLocation(snippet) {
    // Look for "Location: City" pattern
    const locationMatch = snippet.match(/Location: ([^·]+)/);
    if (locationMatch) return locationMatch[1].trim();
    
    // Try standard format
    const parts = snippet.split(' · ');
    for (let part of parts) {
      if (part.includes('Milwaukee') || part.includes('Wisconsin')) {
        return part.trim();
      }
    }
    return null;
  }

  // Score candidate based on criteria
  scoreCandidate(candidate, criteria = {}) {
    let score = 50; // Base score
    
    // Title match
    const titleLower = (candidate.title || '').toLowerCase();
    if (titleLower.includes('financial advisor')) score += 20;
    if (titleLower.includes('wealth')) score += 10;
    if (titleLower.includes('investment')) score += 10;
    if (titleLower.includes('senior')) score += 5;
    
    // Location is intentionally not used for scoring
    
    // Company penalty for current Northwestern Mutual
    const companyLower = (candidate.company || '').toLowerCase();
    if (companyLower.includes('northwestern mutual')) score -= 30;
    
    // Certifications in snippet
    const snippetText = candidate.snippet || '';
    if (snippetText.includes('CFP')) score += 15;
    if (snippetText.includes('Series 7')) score += 10;
    if (snippetText.includes('Series 66')) score += 10;
    if (snippetText.includes('Series 65')) score += 10;
    if (snippetText.includes('ChFC')) score += 10;
    if (snippetText.includes('CFA')) score += 15;
    
    // Experience indicators
    if (snippetText.match(/\d+\+?\s+years?/i)) score += 5;
    if (snippetText.includes('500+ connections')) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }
}

module.exports = LinkedInSearchService;


