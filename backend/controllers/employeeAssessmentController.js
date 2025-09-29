const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Employee Assessment Controller
 * Handles employee assessments and comparison analytics for Northwestern Mutual
 */

// Get all employees for assessment
const getAllEmployees = async (req, res) => {
  try {
    const { department, success_level, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        e.*,
        COUNT(a.id) as assessment_count,
        MAX(a.created_at) as last_assessment_date
      FROM employees e
      LEFT JOIN assessments a ON e.id = a.employee_id AND a.assessment_type = 'employee'
      WHERE e.organization_id = $1 AND e.is_active = true
    `;

    const params = [req.user.organizationId];
    let paramIndex = 1;

    if (department) {
      query += ` AND e.department = $${++paramIndex}`;
      params.push(department);
    }

    if (success_level) {
      query += ` AND e.success_level = $${++paramIndex}`;
      params.push(success_level);
    }

    query += `
      GROUP BY e.id
      ORDER BY e.performance_rating DESC, e.last_name, e.first_name
      LIMIT $${++paramIndex} OFFSET $${++paramIndex}
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM employees e
      WHERE e.organization_id = $1 AND e.is_active = true
    `;

    const countParams = [req.user.organizationId];
    let countParamIndex = 1;

    if (department) {
      countQuery += ` AND e.department = $${++countParamIndex}`;
      countParams.push(department);
    }

    if (success_level) {
      countQuery += ` AND e.success_level = $${++countParamIndex}`;
      countParams.push(success_level);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      employees: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error getting employees:', error);
    res.status(500).json({ error: 'Failed to get employees' });
  }
};

// Start employee assessment
const startEmployeeAssessment = async (req, res) => {
  try {
    const { employeeId } = req.body;

    // Verify employee exists and belongs to organization
    const employeeResult = await db.query(
      'SELECT * FROM employees WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [employeeId, req.user.organizationId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Check if employee already has a completed assessment
    const existingAssessment = await db.query(
      `SELECT * FROM assessments
       WHERE employee_id = $1 AND assessment_type = 'employee' AND status = 'completed'
       ORDER BY created_at DESC LIMIT 1`,
      [employeeId]
    );

    if (existingAssessment.rows.length > 0) {
      return res.json({
        assessmentId: existingAssessment.rows[0].id,
        message: 'Employee already has a completed assessment',
        existing: true
      });
    }

    // Create new employee assessment
    const assessmentId = uuidv4();
    await db.query(
      `INSERT INTO assessments (
        id, employee_id, assessment_type, status, total_questions,
        organization_id, start_time
      ) VALUES ($1, $2, 'employee', 'in_progress', 27, $3, $4)`,
      [assessmentId, employeeId, req.user.organizationId, new Date()]
    );

    res.json({
      assessmentId,
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        department: employee.department,
        position: employee.position
      },
      message: 'Employee assessment started successfully'
    });
  } catch (error) {
    console.error('Error starting employee assessment:', error);
    res.status(500).json({ error: 'Failed to start employee assessment' });
  }
};

// Get employee assessment results
const getEmployeeAssessmentResults = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    // Get assessment with employee details
    const assessmentResult = await db.query(
      `SELECT a.*, e.first_name, e.last_name, e.department, e.position, e.performance_rating
       FROM assessments a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.id = $1 AND a.assessment_type = 'employee' AND a.organization_id = $2`,
      [assessmentId, req.user.organizationId]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee assessment not found' });
    }

    const assessment = assessmentResult.rows[0];

    // Get dimension scores
    const scoresResult = await db.query(
      'SELECT * FROM dimension_scores WHERE assessment_id = $1 ORDER BY dimension',
      [assessmentId]
    );

    // Get responses
    const responsesResult = await db.query(
      'SELECT * FROM responses WHERE assessment_id = $1 ORDER BY question_id',
      [assessmentId]
    );

    res.json({
      assessment: {
        id: assessment.id,
        employee: {
          name: `${assessment.first_name} ${assessment.last_name}`,
          department: assessment.department,
          position: assessment.position,
          performanceRating: assessment.performance_rating
        },
        status: assessment.status,
        startTime: assessment.start_time,
        endTime: assessment.end_time,
        completionPercentage: assessment.completion_percentage
      },
      dimensionScores: scoresResult.rows,
      responses: responsesResult.rows
    });
  } catch (error) {
    console.error('Error getting employee assessment results:', error);
    res.status(500).json({ error: 'Failed to get employee assessment results' });
  }
};

// Create assessment comparison baseline
const createComparisonBaseline = async (req, res) => {
  try {
    const {
      comparisonName,
      description,
      employeeGroupCriteria,
      selectedEmployeeIds
    } = req.body;

    // Get assessment IDs for selected employees
    let assessmentIds = [];

    if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
      const assessmentResult = await db.query(
        `SELECT DISTINCT a.id
         FROM assessments a
         JOIN employees e ON a.employee_id = e.id
         WHERE a.employee_id = ANY($1)
           AND a.assessment_type = 'employee'
           AND a.status = 'completed'
           AND e.organization_id = $2`,
        [selectedEmployeeIds, req.user.organizationId]
      );

      assessmentIds = assessmentResult.rows.map(row => row.id);
    } else if (employeeGroupCriteria) {
      // Build dynamic query based on criteria
      let query = `
        SELECT DISTINCT a.id
        FROM assessments a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.assessment_type = 'employee'
          AND a.status = 'completed'
          AND e.organization_id = $1
      `;

      const params = [req.user.organizationId];
      let paramIndex = 1;

      if (employeeGroupCriteria.department) {
        query += ` AND e.department = $${++paramIndex}`;
        params.push(employeeGroupCriteria.department);
      }

      if (employeeGroupCriteria.success_level) {
        query += ` AND e.success_level = $${++paramIndex}`;
        params.push(employeeGroupCriteria.success_level);
      }

      if (employeeGroupCriteria.performance_rating?.min) {
        query += ` AND e.performance_rating >= $${++paramIndex}`;
        params.push(employeeGroupCriteria.performance_rating.min);
      }

      const assessmentResult = await db.query(query, params);
      assessmentIds = assessmentResult.rows.map(row => row.id);
    }

    if (assessmentIds.length === 0) {
      return res.status(400).json({ error: 'No completed employee assessments found matching criteria' });
    }

    // Create comparison baseline
    const comparisonId = uuidv4();
    await db.query(
      `INSERT INTO assessment_comparisons (
        id, comparison_name, description, employee_group_criteria,
        baseline_assessment_ids, created_by, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        comparisonId,
        comparisonName,
        description,
        JSON.stringify(employeeGroupCriteria),
        assessmentIds,
        req.user.id,
        req.user.organizationId
      ]
    );

    res.json({
      comparisonId,
      baselineAssessmentCount: assessmentIds.length,
      message: 'Comparison baseline created successfully'
    });
  } catch (error) {
    console.error('Error creating comparison baseline:', error);
    res.status(500).json({ error: 'Failed to create comparison baseline' });
  }
};

// Compare candidate to employee baseline
const compareCandidateToBaseline = async (req, res) => {
  try {
    const { candidateId, comparisonId } = req.body;

    // Get candidate's latest completed assessment
    const candidateAssessment = await db.query(
      `SELECT a.* FROM assessments a
       JOIN candidates c ON a.candidate_id = c.id
       WHERE c.id = $1 AND a.status = 'completed' AND c.organization_id = $2
       ORDER BY a.created_at DESC LIMIT 1`,
      [candidateId, req.user.organizationId]
    );

    if (candidateAssessment.rows.length === 0) {
      return res.status(404).json({ error: 'No completed assessment found for candidate' });
    }

    // Get comparison baseline
    const comparison = await db.query(
      'SELECT * FROM assessment_comparisons WHERE id = $1 AND organization_id = $2',
      [comparisonId, req.user.organizationId]
    );

    if (comparison.rows.length === 0) {
      return res.status(404).json({ error: 'Comparison baseline not found' });
    }

    const baselineAssessmentIds = comparison.rows[0].baseline_assessment_ids;
    const candidateAssessmentId = candidateAssessment.rows[0].id;

    // Get candidate dimension scores
    const candidateScores = await db.query(
      'SELECT dimension, score FROM dimension_scores WHERE assessment_id = $1',
      [candidateAssessmentId]
    );

    // Get baseline dimension scores (average of all baseline assessments)
    const baselineScores = await db.query(
      `SELECT dimension, AVG(score) as avg_score, STDDEV(score) as std_score
       FROM dimension_scores
       WHERE assessment_id = ANY($1)
       GROUP BY dimension`,
      [baselineAssessmentIds]
    );

    // Dimension name mapping (candidate format -> employee format)
    const dimensionMapping = {
      'achievement_drive': 'Achievement_Drive',
      'cognitive_flexibility': 'Cognitive_Flexibility',
      'collaborative_intelligence': 'Team_Collaboration',
      'emotional_regulation': 'Emotional_Regulation',
      'ethical_reasoning': 'Ethical_Standards',
      'influence_style': 'Influence_Style',
      'learning_orientation': 'Learning_Orientation',
      'relationship_building': 'Relationship_Building',
      'risk_tolerance': 'Customer_Focus', // Map to closest equivalent
      'self_management': 'Self_Management',
      'social_calibration': 'Social_Calibration',
      'systems_thinking': 'Systems_Thinking'
    };

    // Calculate similarity scores
    const dimensionSimilarityScores = {};
    let totalSimilarity = 0;
    let dimensionCount = 0;

    for (const candidateScore of candidateScores.rows) {
      const mappedDimension = dimensionMapping[candidateScore.dimension] || candidateScore.dimension;
      const baselineScore = baselineScores.rows.find(
        bs => bs.dimension === mappedDimension
      );

      if (baselineScore) {
        // Calculate similarity using normalized distance
        const difference = Math.abs(candidateScore.score - baselineScore.avg_score);
        const maxDifference = 100; // Max possible score difference
        const similarity = Math.max(0, 100 - (difference / maxDifference) * 100);

        dimensionSimilarityScores[candidateScore.dimension] = {
          candidateScore: candidateScore.score,
          baselineAverage: parseFloat(baselineScore.avg_score),
          similarity: Math.round(similarity * 100) / 100,
          mappedTo: mappedDimension
        };

        totalSimilarity += similarity;
        dimensionCount++;
      }
    }

    const overallSimilarity = dimensionCount > 0 ? totalSimilarity / dimensionCount : 0;

    // Determine fit recommendation
    let fitRecommendation, confidenceLevel;
    if (overallSimilarity >= 85) {
      fitRecommendation = 'strong_fit';
      confidenceLevel = 0.9;
    } else if (overallSimilarity >= 70) {
      fitRecommendation = 'moderate_fit';
      confidenceLevel = 0.75;
    } else {
      fitRecommendation = 'poor_fit';
      confidenceLevel = 0.8;
    }

    // Save comparison results
    const comparisonResultId = uuidv4();
    await db.query(
      `INSERT INTO candidate_comparison_scores (
        id, candidate_id, assessment_id, comparison_id, overall_similarity_score,
        dimension_similarity_scores, fit_recommendation, confidence_level, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        comparisonResultId,
        candidateId,
        candidateAssessmentId,
        comparisonId,
        Math.round(overallSimilarity * 100) / 100,
        JSON.stringify(dimensionSimilarityScores),
        fitRecommendation,
        confidenceLevel,
        req.user.organizationId
      ]
    );

    res.json({
      comparisonResultId,
      overallSimilarity: Math.round(overallSimilarity * 100) / 100,
      fitRecommendation,
      confidenceLevel,
      dimensionSimilarityScores,
      baselineInfo: {
        comparisonName: comparison.rows[0].comparison_name,
        baselineAssessmentCount: baselineAssessmentIds.length
      }
    });
  } catch (error) {
    console.error('Error comparing candidate to baseline:', error);
    res.status(500).json({ error: 'Failed to compare candidate to baseline' });
  }
};

// Get all comparison baselines
const getComparisonBaselines = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ac.*, r.first_name as created_by_name, r.last_name as created_by_lastname,
              array_length(baseline_assessment_ids, 1) as baseline_count
       FROM assessment_comparisons ac
       JOIN recruiters r ON ac.created_by = r.id
       WHERE ac.organization_id = $1
       ORDER BY ac.created_at DESC`,
      [req.user.organizationId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting comparison baselines:', error);
    res.status(500).json({ error: 'Failed to get comparison baselines' });
  }
};

// Get candidate comparison history
const getCandidateComparisons = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const result = await db.query(
      `SELECT ccs.*, ac.comparison_name, c.first_name, c.last_name
       FROM candidate_comparison_scores ccs
       JOIN assessment_comparisons ac ON ccs.comparison_id = ac.id
       JOIN candidates c ON ccs.candidate_id = c.id
       WHERE ccs.candidate_id = $1 AND ccs.organization_id = $2
       ORDER BY ccs.created_at DESC`,
      [candidateId, req.user.organizationId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting candidate comparisons:', error);
    res.status(500).json({ error: 'Failed to get candidate comparisons' });
  }
};

module.exports = {
  getAllEmployees,
  startEmployeeAssessment,
  getEmployeeAssessmentResults,
  createComparisonBaseline,
  compareCandidateToBaseline,
  getComparisonBaselines,
  getCandidateComparisons
};