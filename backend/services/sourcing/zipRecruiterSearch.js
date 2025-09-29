const axios = require('axios');

class ZipRecruiterSearchService {
  constructor() {
    this.apiKey = process.env.ZIPRECRUITER_API_KEY;
    this.baseUrl = 'https://api.ziprecruiter.com';
    this.partnerUrl = 'https://api.ziprecruiter.com/partner/v0';
  }

  async searchJobs(params) {
    const {
      search = 'financial advisor',
      location = 'Milwaukee, WI',
      radius_miles = 25,
      days_ago = 30,
      jobs_per_page = 10,
      page = 1
    } = params;

    try {
      const response = await axios.get(`${this.baseUrl}/jobs/v1`, {
        params: {
          search: search,
          location: location,
          radius_miles: radius_miles,
          days_ago: days_ago,
          jobs_per_page: jobs_per_page,
          page: page
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        jobs: response.data.jobs || [],
        totalJobs: response.data.total_jobs || 0,
        page: response.data.page || 1,
        totalPages: response.data.total_pages || 1
      };
    } catch (error) {
      console.error('ZipRecruiter job search error:', error.response?.data || error.message);
      throw error;
    }
  }

  async postJob(jobData) {
    const {
      source,
      source_id,
      title,
      snippet,
      description,
      requirements,
      location,
      category,
      company,
      url,
      salary_min,
      salary_max,
      salary_source,
      salary_type,
      posted_time,
      contact_name,
      contact_email,
      contact_phone
    } = jobData;

    const jobPayload = {
      source: source || 'Northwestern Mutual Platform',
      source_id: source_id,
      title: title,
      snippet: snippet || title,
      description: description,
      requirements: requirements,
      location: location,
      category: category || 'Finance',
      company: company || 'Northwestern Mutual',
      url: url,
      salary_min: salary_min,
      salary_max: salary_max,
      salary_source: salary_source || 'Employer Estimate',
      salary_type: salary_type || 'Annual',
      posted_time: posted_time || new Date().toISOString(),
      contact_name: contact_name,
      contact_email: contact_email,
      contact_phone: contact_phone
    };

    try {
      const response = await axios.post(`${this.partnerUrl}/job`, jobPayload, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        job_id: response.data.job_id,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('ZipRecruiter job posting error:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateJob(jobId, jobData) {
    try {
      const response = await axios.put(`${this.partnerUrl}/job/${jobId}`, jobData, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('ZipRecruiter job update error:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteJob(jobId) {
    try {
      const response = await axios.delete(`${this.partnerUrl}/job/${jobId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('ZipRecruiter job deletion error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getJobDetails(jobId) {
    try {
      const response = await axios.get(`${this.partnerUrl}/job/${jobId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('ZipRecruiter job details error:', error.response?.data || error.message);
      throw error;
    }
  }

  async reportEvent(eventData) {
    const {
      job_id,
      candidate_id,
      event_type, // 'applied', 'interviewed', 'hired', 'rejected'
      event_date,
      notes
    } = eventData;

    const eventPayload = {
      job_id: job_id,
      candidate_id: candidate_id,
      event_type: event_type,
      event_date: event_date || new Date().toISOString(),
      notes: notes
    };

    try {
      const response = await axios.post(`${this.partnerUrl}/event`, eventPayload, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('ZipRecruiter event reporting error:', error.response?.data || error.message);
      throw error;
    }
  }

  async enhanceJobWithFeatures(jobId, features) {
    const {
      traffic_boost = 'single', // 'single', 'double', 'triple'
      priority_placement = false,
      featured_job = false
    } = features;

    const featuresPayload = {
      traffic_boost: traffic_boost,
      priority_placement: priority_placement,
      featured_job: featured_job
    };

    try {
      const response = await axios.post(`${this.partnerUrl}/job/${jobId}/features`, featuresPayload, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('ZipRecruiter job enhancement error:', error.response?.data || error.message);
      throw error;
    }
  }

  parseJobData(job) {
    return {
      source: 'ziprecruiter',
      source_id: job.id,
      title: job.name || job.title,
      company: job.company?.name || job.hiring_company?.name,
      location: job.location,
      job_type: this.parseJobType(job.employment_type),
      description: job.snippet || job.description,
      requirements: job.requirements,
      salary_min: this.parseSalary(job.salary_min),
      salary_max: this.parseSalary(job.salary_max),
      salary_source: job.salary_source,
      currency: 'USD',
      posted_date: job.posted_time,
      apply_url: job.url,
      category: job.category,
      sponsored: job.sponsored || false,
      raw_data: job
    };
  }

  parseJobType(employmentType) {
    const typeMap = {
      'full_time': 'full-time',
      'part_time': 'part-time',
      'contract': 'contract',
      'temporary': 'temporary',
      'internship': 'internship'
    };
    return typeMap[employmentType] || 'full-time';
  }

  parseSalary(salary) {
    if (typeof salary === 'number') return salary;
    if (typeof salary === 'string') {
      const parsed = parseFloat(salary.replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  scoreJob(job, criteria = {}) {
    let score = 50;

    const title = (job.name || job.title || '').toLowerCase();
    const description = (job.snippet || job.description || '').toLowerCase();
    const company = (job.company?.name || job.hiring_company?.name || '').toLowerCase();

    if (title.includes('financial advisor')) score += 20;
    if (title.includes('wealth')) score += 10;
    if (title.includes('investment')) score += 10;
    if (title.includes('senior')) score += 5;

    if (description.includes('cfp')) score += 15;
    if (description.includes('series 7')) score += 10;
    if (description.includes('series 66')) score += 10;
    if (description.includes('series 65')) score += 10;

    if (company.includes('northwestern mutual')) score -= 30;

    const salaryMin = this.parseSalary(job.salary_min);
    if (salaryMin && salaryMin > 80000) score += 10;

    if (job.sponsored) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  buildSearchQuery(params) {
    const {
      title = 'financial advisor',
      location = 'Milwaukee, WI',
      keywords = [],
      excludeKeywords = []
    } = params;

    let query = title;

    if (keywords.length > 0) {
      query += ' ' + keywords.join(' ');
    }

    if (excludeKeywords.length > 0) {
      query += ' -' + excludeKeywords.join(' -');
    }

    return {
      search: query,
      location: location
    };
  }
}

module.exports = ZipRecruiterSearchService;