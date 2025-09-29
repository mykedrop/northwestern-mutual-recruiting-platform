const axios = require('axios');

class IndeedSearchService {
  constructor() {
    this.clientId = process.env.INDEED_CLIENT_ID;
    this.clientSecret = process.env.INDEED_CLIENT_SECRET;
    this.baseUrl = 'https://apis.indeed.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/oauth/v2/tokens`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        scope: 'employer_access'
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 min early

      console.log('Indeed access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Indeed OAuth error:', error.response?.data || error.message);
      throw new Error('Failed to obtain Indeed access token');
    }
  }

  async searchJobs(params) {
    const {
      title = 'financial advisor',
      location = 'Milwaukee, WI',
      radius = 25,
      jobType = 'fulltime',
      limit = 10
    } = params;

    const token = await this.getAccessToken();

    const query = `
      query SearchJobs($input: JobSearchInput!) {
        jobSearch(input: $input) {
          jobs {
            id
            title
            company {
              name
              displayName
            }
            location {
              city
              state
              countryCode
            }
            jobTypes
            description
            requirements
            salaryRange {
              min
              max
              currency
            }
            postedDate
            applyUrl
            sponsored
          }
          totalCount
          hasNextPage
        }
      }
    `;

    const variables = {
      input: {
        query: title,
        location: location,
        radius: radius,
        jobType: jobType,
        limit: limit,
        sort: 'relevance'
      }
    };

    try {
      const response = await axios.post(`${this.baseUrl}/graphql`, {
        query: query,
        variables: variables
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return {
        jobs: response.data.data.jobSearch.jobs || [],
        totalCount: response.data.data.jobSearch.totalCount || 0,
        hasNextPage: response.data.data.jobSearch.hasNextPage || false
      };
    } catch (error) {
      console.error('Indeed job search error:', error.response?.data || error.message);
      throw error;
    }
  }

  async postJob(jobData) {
    const {
      title,
      description,
      requirements,
      location,
      jobType = 'FULL_TIME',
      salaryMin,
      salaryMax,
      currency = 'USD',
      companyName,
      contactEmail,
      applyInstructions
    } = jobData;

    const token = await this.getAccessToken();

    const mutation = `
      mutation CreateJobPosting($input: JobPostingInput!) {
        createJobPosting(input: $input) {
          jobPosting {
            id
            title
            status
            postedDate
            expirationDate
            viewCount
            applicationCount
          }
          errors {
            message
            field
          }
        }
      }
    `;

    const variables = {
      input: {
        title: title,
        description: description,
        requirements: requirements,
        location: {
          city: location.city,
          state: location.state,
          countryCode: location.countryCode || 'US'
        },
        jobType: jobType,
        salaryRange: salaryMin && salaryMax ? {
          min: salaryMin,
          max: salaryMax,
          currency: currency
        } : null,
        company: {
          name: companyName
        },
        applicationMethod: {
          email: contactEmail,
          instructions: applyInstructions
        }
      }
    };

    try {
      const response = await axios.post(`${this.baseUrl}/graphql`, {
        query: mutation,
        variables: variables
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      const result = response.data.data.createJobPosting;
      if (result.errors && result.errors.length > 0) {
        throw new Error(`Job posting errors: ${JSON.stringify(result.errors)}`);
      }

      return result.jobPosting;
    } catch (error) {
      console.error('Indeed job posting error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getJobApplications(jobId) {
    const token = await this.getAccessToken();

    const query = `
      query GetJobApplications($jobId: ID!) {
        jobPosting(id: $jobId) {
          id
          title
          applications {
            id
            candidate {
              name
              email
              phone
              resumeUrl
            }
            appliedDate
            status
            notes
          }
        }
      }
    `;

    const variables = { jobId };

    try {
      const response = await axios.post(`${this.baseUrl}/graphql`, {
        query: query,
        variables: variables
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data.jobPosting;
    } catch (error) {
      console.error('Indeed applications fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async expireJob(jobId) {
    const token = await this.getAccessToken();

    const mutation = `
      mutation ExpireJobPosting($jobId: ID!) {
        expireJobPosting(id: $jobId) {
          jobPosting {
            id
            status
            expirationDate
          }
          errors {
            message
            field
          }
        }
      }
    `;

    const variables = { jobId };

    try {
      const response = await axios.post(`${this.baseUrl}/graphql`, {
        query: mutation,
        variables: variables
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      const result = response.data.data.expireJobPosting;
      if (result.errors && result.errors.length > 0) {
        throw new Error(`Job expiration errors: ${JSON.stringify(result.errors)}`);
      }

      return result.jobPosting;
    } catch (error) {
      console.error('Indeed job expiration error:', error.response?.data || error.message);
      throw error;
    }
  }

  parseJobData(job) {
    return {
      source: 'indeed',
      source_id: job.id,
      title: job.title,
      company: job.company?.displayName || job.company?.name,
      location: job.location ? `${job.location.city}, ${job.location.state}` : null,
      job_type: job.jobTypes?.[0] || 'full-time',
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salaryRange?.min,
      salary_max: job.salaryRange?.max,
      currency: job.salaryRange?.currency,
      posted_date: job.postedDate,
      apply_url: job.applyUrl,
      sponsored: job.sponsored || false,
      raw_data: job
    };
  }

  scoreJob(job, criteria = {}) {
    let score = 50;

    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase();

    if (title.includes('financial advisor')) score += 20;
    if (title.includes('wealth')) score += 10;
    if (title.includes('investment')) score += 10;
    if (title.includes('senior')) score += 5;

    if (description.includes('cfp')) score += 15;
    if (description.includes('series 7')) score += 10;
    if (description.includes('series 66')) score += 10;

    if (job.salaryRange?.min > 80000) score += 10;
    if (job.sponsored) score += 5;

    return Math.min(100, Math.max(0, score));
  }
}

module.exports = IndeedSearchService;