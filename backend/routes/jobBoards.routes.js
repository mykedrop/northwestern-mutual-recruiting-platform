const express = require('express');
const router = express.Router();
const JobBoardIntegrationService = require('../services/sourcing/jobBoardIntegration');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

const jobBoardService = new JobBoardIntegrationService();

router.get('/sources', authMiddleware, async (req, res) => {
  try {
    const sources = jobBoardService.getSupportedSources();
    res.json({ success: true, sources });
  } catch (error) {
    console.error('Get job board sources error:', error);
    res.status(500).json({ error: 'Failed to get job board sources' });
  }
});

router.post('/search', authMiddleware, async (req, res) => {
  try {
    const {
      sources = ['indeed', 'ziprecruiter'],
      title = 'financial advisor',
      location = 'Milwaukee, WI',
      limit = 20,
      saveResults = false,
      campaignId = null
    } = req.body;

    const searchResults = await jobBoardService.searchAllSources({
      sources,
      title,
      location,
      limit: Math.floor(limit / sources.length)
    });

    let savedJobs = [];
    if (saveResults && searchResults.jobs.length > 0) {
      savedJobs = await jobBoardService.saveJobsToDatabase(
        searchResults.jobs,
        campaignId
      );
    }

    const response = {
      success: true,
      results: searchResults,
      saved: saveResults ? {
        total: savedJobs.length,
        new: savedJobs.filter(j => j.saved).length,
        duplicates: savedJobs.filter(j => !j.saved && j.reason === 'duplicate').length,
        errors: savedJobs.filter(j => !j.saved && j.error).length
      } : null
    };

    res.json(response);
  } catch (error) {
    console.error('Job board search error:', error);
    res.status(500).json({ error: 'Failed to search job boards' });
  }
});

router.post('/post', authMiddleware, async (req, res) => {
  try {
    const {
      sources = ['indeed', 'ziprecruiter'],
      title,
      description,
      requirements,
      location,
      jobType,
      salaryMin,
      salaryMax,
      companyName,
      contactEmail,
      applyInstructions
    } = req.body;

    if (!title || !description || !location) {
      return res.status(400).json({
        error: 'Title, description, and location are required'
      });
    }

    const jobData = {
      title,
      description,
      requirements,
      location: typeof location === 'string' ? { city: location } : location,
      jobType: jobType || 'FULL_TIME',
      salaryMin,
      salaryMax,
      companyName: companyName || 'Northwestern Mutual',
      contactEmail,
      applyInstructions
    };

    const results = await jobBoardService.postJobToSources(jobData, sources);

    await db.query(`
      INSERT INTO job_postings (
        title, description, location, sources, posted_by, status, external_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      title,
      description,
      JSON.stringify(location),
      JSON.stringify(sources),
      req.user.userId,
      'active',
      JSON.stringify(results.summary)
    ]);

    res.json({
      success: true,
      results: results,
      message: `Job posted to ${results.successes.length} out of ${sources.length} sources`
    });
  } catch (error) {
    console.error('Job posting error:', error);
    res.status(500).json({ error: 'Failed to post job to job boards' });
  }
});

router.get('/jobs/:jobId/applications', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { source } = req.query;

    if (!source) {
      return res.status(400).json({
        error: 'Source parameter is required'
      });
    }

    const applications = await jobBoardService.getJobApplications(jobId, source);

    res.json({
      success: true,
      applications: applications
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Failed to get job applications' });
  }
});

router.delete('/jobs/:jobId', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { source } = req.body;

    if (!source) {
      return res.status(400).json({
        error: 'Source is required in request body'
      });
    }

    const result = await jobBoardService.expireJob(jobId, source);

    res.json({
      success: true,
      result: result,
      message: `Job ${jobId} expired on ${source}`
    });
  } catch (error) {
    console.error('Job expiration error:', error);
    res.status(500).json({ error: 'Failed to expire job' });
  }
});

router.get('/campaigns/:campaignId/jobs', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { source, status, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT sc.*, sc.raw_data->>'apply_url' as apply_url
      FROM sourced_candidates sc
      WHERE sc.campaign_id = $1
    `;
    const params = [campaignId];

    if (source) {
      query += ` AND sc.source = $${params.length + 1}`;
      params.push(source);
    }

    if (status) {
      query += ` AND sc.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY sc.score DESC, sc.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countQuery = query.split('ORDER BY')[0].replace('SELECT sc.*, sc.raw_data->\'apply_url\' as apply_url', 'SELECT COUNT(*)');
    const countResult = await db.query(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      jobs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Get campaign jobs error:', error);
    res.status(500).json({ error: 'Failed to get campaign jobs' });
  }
});

router.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    const { source } = req.body;

    if (!source) {
      return res.status(400).json({
        error: 'Source is required'
      });
    }

    let testResult;

    switch (source) {
      case 'indeed':
        testResult = await jobBoardService.indeed.searchJobs({
          title: 'test',
          location: 'New York',
          limit: 1
        });
        break;
      case 'ziprecruiter':
        testResult = await jobBoardService.ziprecruiter.searchJobs({
          search: 'test',
          location: 'New York',
          jobs_per_page: 1
        });
        break;
      default:
        return res.status(400).json({
          error: `Unsupported source: ${source}`
        });
    }

    res.json({
      success: true,
      connected: true,
      source: source,
      message: `Successfully connected to ${source}`,
      testResult: {
        jobsFound: testResult.jobs?.length || testResult.totalJobs || 0
      }
    });
  } catch (error) {
    console.error(`${source} connection test error:`, error);
    res.json({
      success: false,
      connected: false,
      source: source,
      error: error.message,
      message: `Failed to connect to ${source}`
    });
  }
});

module.exports = router;