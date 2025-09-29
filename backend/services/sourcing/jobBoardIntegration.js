const IndeedSearchService = require('./indeedSearch');
const ZipRecruiterSearchService = require('./zipRecruiterSearch');
const db = require('../../db');

class JobBoardIntegrationService {
  constructor() {
    this.indeed = new IndeedSearchService();
    this.ziprecruiter = new ZipRecruiterSearchService();
    this.supportedSources = ['indeed', 'ziprecruiter'];
  }

  async searchAllSources(params) {
    const {
      sources = this.supportedSources,
      title = 'financial advisor',
      location = 'Milwaukee, WI',
      limit = 10
    } = params;

    const results = {
      jobs: [],
      totalCount: 0,
      sources: {},
      errors: []
    };

    const searchPromises = sources.map(async (source) => {
      try {
        let sourceResults;

        switch (source) {
          case 'indeed':
            sourceResults = await this.indeed.searchJobs({
              title,
              location,
              limit
            });
            break;
          case 'ziprecruiter':
            sourceResults = await this.ziprecruiter.searchJobs({
              search: title,
              location,
              jobs_per_page: limit
            });
            break;
          default:
            throw new Error(`Unsupported source: ${source}`);
        }

        const parsedJobs = this.parseSourceJobs(source, sourceResults);

        results.sources[source] = {
          count: parsedJobs.length,
          totalAvailable: sourceResults.totalCount || sourceResults.totalJobs || 0,
          success: true
        };

        return parsedJobs;
      } catch (error) {
        console.error(`Error searching ${source}:`, error.message);
        results.errors.push({
          source: source,
          error: error.message
        });
        results.sources[source] = {
          count: 0,
          totalAvailable: 0,
          success: false,
          error: error.message
        };
        return [];
      }
    });

    const allSourceResults = await Promise.all(searchPromises);

    allSourceResults.forEach(sourceJobs => {
      results.jobs.push(...sourceJobs);
    });

    results.totalCount = results.jobs.length;

    results.jobs.sort((a, b) => b.score - a.score);

    return results;
  }

  parseSourceJobs(source, sourceResults) {
    const jobs = source === 'indeed' ? sourceResults.jobs : sourceResults.jobs;

    return jobs.map(job => {
      let parsedJob, score;

      switch (source) {
        case 'indeed':
          parsedJob = this.indeed.parseJobData(job);
          score = this.indeed.scoreJob(job);
          break;
        case 'ziprecruiter':
          parsedJob = this.ziprecruiter.parseJobData(job);
          score = this.ziprecruiter.scoreJob(job);
          break;
        default:
          parsedJob = job;
          score = 50;
      }

      return {
        ...parsedJob,
        score: score,
        relevanceScore: this.calculateRelevanceScore(parsedJob),
        searchedAt: new Date()
      };
    });
  }

  calculateRelevanceScore(job) {
    let score = 0;
    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase();

    if (title.includes('financial advisor')) score += 25;
    if (title.includes('wealth management')) score += 20;
    if (title.includes('investment')) score += 15;
    if (description.includes('cfp') || description.includes('certified financial planner')) score += 15;
    if (description.includes('series 7') || description.includes('series 66')) score += 10;

    if (job.salary_min && job.salary_min > 60000) score += 10;
    if (job.salary_max && job.salary_max > 100000) score += 5;

    return Math.min(100, score);
  }

  async saveJobsToDatabase(jobs, campaignId = null) {
    const savedJobs = [];

    for (const job of jobs) {
      try {
        const existingJob = await db.query(`
          SELECT id FROM sourced_candidates
          WHERE source = $1 AND source_url = $2
        `, [job.source, job.apply_url]);

        if (existingJob.rows.length === 0) {
          const result = await db.query(`
            INSERT INTO sourced_candidates (
              source, source_url, name, title, company, location,
              raw_data, processed_data, score, status, campaign_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
          `, [
            job.source,
            job.apply_url,
            job.title, // Using title as name for job postings
            job.title,
            job.company,
            job.location,
            JSON.stringify(job.raw_data),
            JSON.stringify({
              job_type: job.job_type,
              salary_min: job.salary_min,
              salary_max: job.salary_max,
              posted_date: job.posted_date,
              relevanceScore: job.relevanceScore
            }),
            job.score,
            'new',
            campaignId
          ]);

          savedJobs.push({
            ...job,
            id: result.rows[0].id,
            saved: true
          });
        } else {
          savedJobs.push({
            ...job,
            id: existingJob.rows[0].id,
            saved: false,
            reason: 'duplicate'
          });
        }
      } catch (error) {
        console.error('Error saving job:', error);
        savedJobs.push({
          ...job,
          saved: false,
          error: error.message
        });
      }
    }

    return savedJobs;
  }

  async postJobToSources(jobData, sources = ['indeed', 'ziprecruiter']) {
    const results = {
      successes: [],
      failures: [],
      summary: {}
    };

    for (const source of sources) {
      try {
        let result;

        switch (source) {
          case 'indeed':
            result = await this.indeed.postJob(jobData);
            break;
          case 'ziprecruiter':
            result = await this.ziprecruiter.postJob(jobData);
            break;
          default:
            throw new Error(`Unsupported source: ${source}`);
        }

        results.successes.push({
          source: source,
          jobId: result.id || result.job_id,
          data: result
        });

        results.summary[source] = {
          success: true,
          jobId: result.id || result.job_id
        };

      } catch (error) {
        console.error(`Error posting to ${source}:`, error.message);

        results.failures.push({
          source: source,
          error: error.message
        });

        results.summary[source] = {
          success: false,
          error: error.message
        };
      }
    }

    return results;
  }

  async getJobApplications(jobId, source) {
    try {
      switch (source) {
        case 'indeed':
          return await this.indeed.getJobApplications(jobId);
        case 'ziprecruiter':
          return await this.ziprecruiter.getJobDetails(jobId);
        default:
          throw new Error(`Unsupported source: ${source}`);
      }
    } catch (error) {
      console.error(`Error getting applications from ${source}:`, error.message);
      throw error;
    }
  }

  async expireJob(jobId, source) {
    try {
      switch (source) {
        case 'indeed':
          return await this.indeed.expireJob(jobId);
        case 'ziprecruiter':
          return await this.ziprecruiter.deleteJob(jobId);
        default:
          throw new Error(`Unsupported source: ${source}`);
      }
    } catch (error) {
      console.error(`Error expiring job on ${source}:`, error.message);
      throw error;
    }
  }

  getSupportedSources() {
    return this.supportedSources.map(source => ({
      id: source,
      name: this.getSourceDisplayName(source),
      capabilities: this.getSourceCapabilities(source)
    }));
  }

  getSourceDisplayName(source) {
    const displayNames = {
      'indeed': 'Indeed',
      'ziprecruiter': 'ZipRecruiter'
    };
    return displayNames[source] || source;
  }

  getSourceCapabilities(source) {
    const capabilities = {
      'indeed': ['job_search', 'job_posting', 'application_tracking', 'job_expiration'],
      'ziprecruiter': ['job_search', 'job_posting', 'application_tracking', 'job_deletion', 'event_reporting']
    };
    return capabilities[source] || [];
  }
}

module.exports = JobBoardIntegrationService;