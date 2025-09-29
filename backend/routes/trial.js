const express = require('express');
const router = express.Router();
const db = require('../db');

// Track trial metrics
router.post('/track', async (req, res) => {
    try {
        const { event, data } = req.body;

        // Store event
        await db.query(
            'INSERT INTO trial_events (event_name, event_data, user_id) VALUES ($1, $2, $3)',
            [event, JSON.stringify(data), req.userId]
        );

        // Update metrics
        await updateTrialMetrics(event);

        res.json({ success: true });
    } catch (error) {
        console.error('Trial tracking error:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// Get current trial metrics
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await calculateTrialMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

// Daily report generation
router.get('/daily-report', async (req, res) => {
    try {
        const report = await generateDailyReport();
        res.json(report);
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

async function calculateTrialMetrics() {
    const trialStart = new Date('2024-01-15');

    // Get candidate count
    const candidates = await db.query(
        'SELECT COUNT(*) as count FROM candidates WHERE created_at >= $1',
        [trialStart]
    );

    // Get search count
    const searches = await db.query(
        'SELECT COUNT(*) as count FROM trial_events WHERE event_name = $1 AND created_at >= $2',
        ['search_performed', trialStart]
    );

    // Get message count (fallback if table doesn't exist)
    let messages;
    try {
        messages = await db.query(
            'SELECT COUNT(*) as count FROM outreach_campaigns WHERE created_at >= $1',
            [trialStart]
        );
    } catch (error) {
        messages = { rows: [{ count: '0' }] };
    }

    // Get interview count (fallback if table doesn't exist)
    let interviews;
    try {
        interviews = await db.query(
            'SELECT COUNT(*) as count FROM interviews WHERE created_at >= $1',
            [trialStart]
        );
    } catch (error) {
        interviews = { rows: [{ count: '0' }] };
    }

    // Calculate derived metrics
    const candidatesSourced = parseInt(candidates.rows[0].count);
    const searchesPerformed = parseInt(searches.rows[0].count);
    const messagesSent = parseInt(messages.rows[0].count);
    const interviewsScheduled = parseInt(interviews.rows[0].count);

    // Calculate value metrics
    const hoursSaved = candidatesSourced * 0.5; // 30 min saved per candidate
    const valueCreated = hoursSaved * 150; // $150/hour loaded cost
    const roi = valueCreated / 15000; // ROI vs monthly cost

    return {
        candidatesSourced,
        searchesPerformed,
        messagesSent,
        interviewsScheduled,
        hoursSaved: Math.round(hoursSaved),
        valueCreated: Math.round(valueCreated),
        roiMultiple: roi.toFixed(1)
    };
}

async function updateTrialMetrics(event) {
    // Update specific metrics based on event
    const updates = {
        'search_performed': 'searches_count',
        'candidate_viewed': 'views_count',
        'message_sent': 'messages_count',
        'interview_scheduled': 'interviews_count'
    };

    if (updates[event]) {
        await db.query(
            `UPDATE trial_metrics SET ${updates[event]} = ${updates[event]} + 1 WHERE date = CURRENT_DATE`
        );
    }
}

async function generateDailyReport() {
    const metrics = await calculateTrialMetrics();
    const dayNumber = Math.floor((Date.now() - new Date('2024-01-15')) / (1000 * 60 * 60 * 24)) + 1;

    return {
        dayNumber,
        metrics,
        highlights: [
            `Day ${dayNumber} of Northwestern Mutual Trial`,
            `${metrics.candidatesSourced} total candidates sourced`,
            `$${metrics.valueCreated.toLocaleString()} in value created`,
            `${metrics.roiMultiple}x ROI achieved`
        ],
        recommendations: getRecommendations(dayNumber, metrics)
    };
}

function getRecommendations(day, metrics) {
    const recommendations = [];

    if (day <= 7) {
        recommendations.push('Focus on demonstrating search efficiency');
        recommendations.push('Schedule daily check-ins with recruiters');
    } else if (day <= 14) {
        recommendations.push('Show pipeline growth metrics');
        recommendations.push('Document success stories');
    } else if (day <= 21) {
        recommendations.push('Demonstrate automation capabilities');
        recommendations.push('Calculate total ROI');
    } else {
        recommendations.push('Present conversion offer');
        recommendations.push('Highlight dependency on system');
    }

    return recommendations;
}

module.exports = router;