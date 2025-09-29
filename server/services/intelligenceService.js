const db = require('../config/database');

class IntelligenceService {
    constructor() {
        this.dimensionDescriptions = {
            cognitive_flexibility: 'adaptability and creative problem-solving',
            emotional_regulation: 'emotional control and stress management',
            social_calibration: 'social awareness and interpersonal sensitivity',
            achievement_drive: 'goal orientation and competitive spirit',
            learning_orientation: 'curiosity and continuous improvement',
            risk_tolerance: 'comfort with uncertainty and calculated risks',
            relationship_building: 'networking and relationship development',
            ethical_reasoning: 'integrity and moral decision-making',
            influence_style: 'leadership and persuasion capabilities',
            systems_thinking: 'analytical and strategic thinking',
            self_management: 'organization and personal discipline',
            collaborative_intelligence: 'teamwork and cooperative skills'
        };
    }

    async generateIntelligenceReport(assessmentId, dimensionScores, frameworkMappings) {
        try {
            // Generate all report sections
            const executiveSummary = this.generateExecutiveSummary(dimensionScores);
            const strengths = this.identifyStrengths(dimensionScores);
            const growthAreas = this.identifyGrowthAreas(dimensionScores);
            const behavioralPredictions = this.generateBehavioralPredictions(dimensionScores);
            const communicationStyle = this.analyzeCommunicationStyle(dimensionScores, frameworkMappings);
            const workStyle = this.analyzeWorkStyle(dimensionScores);
            const teamDynamics = this.predictTeamDynamics(dimensionScores);
            const riskFactors = this.identifyRiskFactors(dimensionScores);
            const recommendations = this.generateRecommendations(dimensionScores);
            const culturalFitScore = this.calculateCulturalFit(dimensionScores);
            const roleFitScores = this.calculateRoleFit(dimensionScores);

            // Save to database
            const result = await db.query(
                `INSERT INTO intelligence_reports 
                (assessment_id, executive_summary, strengths, growth_areas, 
                behavioral_predictions, communication_style, work_style, 
                team_dynamics, risk_factors, recommendations, 
                cultural_fit_score, role_fit_scores)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (assessment_id) 
                DO UPDATE SET 
                    executive_summary = $2,
                    strengths = $3,
                    growth_areas = $4,
                    behavioral_predictions = $5,
                    communication_style = $6,
                    work_style = $7,
                    team_dynamics = $8,
                    risk_factors = $9,
                    recommendations = $10,
                    cultural_fit_score = $11,
                    role_fit_scores = $12,
                    generated_at = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    assessmentId,
                    executiveSummary,
                    JSON.stringify(strengths),
                    JSON.stringify(growthAreas),
                    JSON.stringify(behavioralPredictions),
                    JSON.stringify(communicationStyle),
                    JSON.stringify(workStyle),
                    JSON.stringify(teamDynamics),
                    JSON.stringify(riskFactors),
                    JSON.stringify(recommendations),
                    culturalFitScore,
                    JSON.stringify(roleFitScores)
                ]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error generating intelligence report:', error);
            throw error;
        }
    }

    generateExecutiveSummary(scores) {
        // Convert scores to numbers to ensure proper calculation
        const numericScores = scores.map(s => ({ ...s, score: parseFloat(s.score) }));
        const avgScore = numericScores.reduce((sum, s) => sum + s.score, 0) / numericScores.length;
        const topDimensions = numericScores
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(s => this.dimensionDescriptions[s.dimension]);

        let summary = '';
        
        if (avgScore >= 80) {
            summary = `This candidate demonstrates exceptional overall capabilities with an average dimensional score of ${avgScore.toFixed(1)}. `;
            summary += `They show particular strength in ${topDimensions.join(', ')}, `;
            summary += `positioning them as a high-potential candidate who could make immediate and significant contributions to Northwestern Mutual.`;
        } else if (avgScore >= 70) {
            summary = `This candidate shows strong overall potential with an average dimensional score of ${avgScore.toFixed(1)}. `;
            summary += `Key strengths include ${topDimensions.join(', ')}. `;
            summary += `With targeted development, this individual could excel in client-facing roles at Northwestern Mutual.`;
        } else if (avgScore >= 60) {
            summary = `This candidate displays solid foundational capabilities with an average dimensional score of ${avgScore.toFixed(1)}. `;
            summary += `Notable competencies include ${topDimensions.join(', ')}. `;
            summary += `They would benefit from structured onboarding and mentorship to reach their full potential.`;
        } else {
            summary = `This candidate shows developing capabilities with an average dimensional score of ${avgScore.toFixed(1)}. `;
            summary += `Areas of relative strength include ${topDimensions.join(', ')}. `;
            summary += `Significant development and support would be needed for success in demanding roles.`;
        }

        return summary;
    }

    identifyStrengths(scores) {
        const strengths = [];
        const numericScores = scores.map(s => ({ ...s, score: parseFloat(s.score) }));
        
        numericScores.forEach(dimension => {
            if (dimension.score >= 80) {
                strengths.push({
                    dimension: dimension.dimension,
                    score: dimension.score,
                    insight: this.generateStrengthInsight(dimension.dimension, dimension.score)
                });
            }
        });

        return strengths.sort((a, b) => b.score - a.score);
    }

    generateStrengthInsight(dimension, score) {
        const insights = {
            cognitive_flexibility: {
                90: "Exceptional ability to adapt strategies and think creatively. This candidate will thrive in dynamic environments and excel at solving complex, novel problems.",
                80: "Strong adaptability and creative thinking skills. Comfortable with change and capable of generating innovative solutions."
            },
            emotional_regulation: {
                90: "Outstanding emotional control even under extreme pressure. This candidate will remain composed and make rational decisions in high-stress situations.",
                80: "Excellent stress management and emotional stability. Maintains professional composure and clear thinking during challenging interactions."
            },
            social_calibration: {
                90: "Masterful at reading social dynamics and adjusting approach accordingly. Will build strong client relationships and navigate complex interpersonal situations with ease.",
                80: "Highly perceptive of social cues and skilled at interpersonal interactions. Builds rapport quickly and manages relationships effectively."
            },
            achievement_drive: {
                90: "Exceptionally driven to exceed goals and outperform expectations. This candidate will consistently push for excellence and inspire others to achieve more.",
                80: "Strongly motivated by achievement and success. Sets ambitious goals and persistently works toward exceeding targets."
            },
            learning_orientation: {
                90: "Insatiable curiosity and commitment to continuous improvement. Will rapidly acquire new skills and stay ahead of industry trends.",
                80: "Strong desire to learn and grow professionally. Actively seeks feedback and quickly integrates new knowledge."
            },
            risk_tolerance: {
                90: "Exceptional comfort with uncertainty and calculated risk-taking. Will confidently make decisions with incomplete information and pioneer new approaches.",
                80: "Comfortable taking calculated risks when appropriate. Balances bold action with prudent analysis."
            },
            relationship_building: {
                90: "Natural relationship builder who creates deep, lasting professional connections. Will excel at client retention and team collaboration.",
                80: "Strong networking and relationship development skills. Builds trust quickly and maintains positive professional relationships."
            },
            ethical_reasoning: {
                90: "Unwavering commitment to integrity and ethical standards. Will serve as a moral compass for the team and protect Northwestern Mutual's reputation.",
                80: "Strong ethical foundation and commitment to doing the right thing. Makes principled decisions even when faced with pressure."
            },
            influence_style: {
                90: "Charismatic leader who naturally inspires and motivates others. Will excel in leadership roles and drive organizational change.",
                80: "Effective at influencing and persuading others. Comfortable taking leadership roles and guiding team efforts."
            },
            systems_thinking: {
                90: "Exceptional ability to see the big picture and understand complex interconnections. Will excel at strategic planning and process optimization.",
                80: "Strong analytical and strategic thinking capabilities. Effectively identifies patterns and solves complex problems."
            },
            self_management: {
                90: "Exceptional personal discipline and organizational skills. Will consistently deliver high-quality work on time and manage multiple priorities effortlessly.",
                80: "Highly organized and self-directed. Manages time effectively and maintains consistent productivity."
            },
            collaborative_intelligence: {
                90: "Outstanding team player who elevates group performance. Will foster collaboration and create synergy within any team.",
                80: "Strong collaborative skills and team orientation. Works effectively with others and contributes to group success."
            }
        };

        const level = score >= 90 ? 90 : 80;
        return insights[dimension]?.[level] || `Shows strong capability in ${this.dimensionDescriptions[dimension]}`;
    }

    identifyGrowthAreas(scores) {
        const growthAreas = [];
        const numericScores = scores.map(s => ({ ...s, score: parseFloat(s.score) }));
        
        numericScores.forEach(dimension => {
            if (dimension.score < 60) {
                growthAreas.push({
                    dimension: dimension.dimension,
                    score: dimension.score,
                    insight: this.generateGrowthInsight(dimension.dimension, dimension.score),
                    recommendation: this.generateDevelopmentRecommendation(dimension.dimension)
                });
            }
        });

        return growthAreas.sort((a, b) => a.score - b.score);
    }

    generateGrowthInsight(dimension, score) {
        const descriptions = {
            cognitive_flexibility: "May struggle with rapid changes or unconventional problems",
            emotional_regulation: "Could experience difficulty managing stress in high-pressure situations",
            social_calibration: "May miss important social cues or struggle with interpersonal nuances",
            achievement_drive: "Might lack the competitive edge needed for sales-driven environments",
            learning_orientation: "Could resist new approaches or be slow to acquire new skills",
            risk_tolerance: "May be overly cautious or struggle with ambiguous situations",
            relationship_building: "Could have difficulty establishing deep professional connections",
            ethical_reasoning: "May occasionally struggle with complex ethical dilemmas",
            influence_style: "Might find it challenging to persuade or lead others effectively",
            systems_thinking: "Could miss important connections or struggle with strategic planning",
            self_management: "May have difficulty with organization or time management",
            collaborative_intelligence: "Could struggle in team settings or with collaborative projects"
        };

        if (score < 40) {
            return `Significant development needed in ${this.dimensionDescriptions[dimension]}. ${descriptions[dimension]}.`;
        } else {
            return `Room for growth in ${this.dimensionDescriptions[dimension]}. ${descriptions[dimension]}.`;
        }
    }

    generateDevelopmentRecommendation(dimension) {
        const recommendations = {
            cognitive_flexibility: "Provide exposure to diverse problem-solving scenarios and encourage creative thinking exercises",
            emotional_regulation: "Offer stress management training and mindfulness techniques",
            social_calibration: "Provide interpersonal skills training and feedback on social interactions",
            achievement_drive: "Set clear goals with incremental challenges and celebrate achievements",
            learning_orientation: "Encourage participation in training programs and create a safe environment for experimentation",
            risk_tolerance: "Start with small, controlled risks and gradually increase complexity",
            relationship_building: "Provide networking opportunities and mentorship on relationship development",
            ethical_reasoning: "Discuss ethical scenarios and provide clear guidelines on company values",
            influence_style: "Offer presentation skills training and leadership development opportunities",
            systems_thinking: "Provide training on strategic thinking and systems analysis",
            self_management: "Implement time management tools and organizational systems",
            collaborative_intelligence: "Facilitate team projects and provide feedback on collaboration skills"
        };

        return recommendations[dimension] || "Provide targeted coaching and development opportunities";
    }

    generateBehavioralPredictions(scores) {
        const predictions = [];
        const scoreMap = this.createScoreMap(scores);

        // Client Interactions
        if (scoreMap.relationship_building >= 70 && scoreMap.social_calibration >= 70) {
            predictions.push({
                category: "Client Interactions",
                prediction: "Will excel at building and maintaining client relationships",
                confidence: "High"
            });
        } else if (scoreMap.relationship_building < 50 || scoreMap.social_calibration < 50) {
            predictions.push({
                category: "Client Interactions",
                prediction: "May need support in client-facing situations",
                confidence: "High"
            });
        }

        // Team Dynamics
        if (scoreMap.collaborative_intelligence >= 70 && scoreMap.emotional_regulation >= 70) {
            predictions.push({
                category: "Team Dynamics",
                prediction: "Will be a positive team contributor and help maintain group harmony",
                confidence: "High"
            });
        } else if (scoreMap.collaborative_intelligence < 50) {
            predictions.push({
                category: "Team Dynamics",
                prediction: "May prefer independent work over team collaboration",
                confidence: "Medium"
            });
        }

        // Performance Under Pressure
        if (scoreMap.emotional_regulation >= 75 && scoreMap.self_management >= 70) {
            predictions.push({
                category: "Stress Management",
                prediction: "Will maintain high performance even under significant pressure",
                confidence: "High"
            });
        } else if (scoreMap.emotional_regulation < 50) {
            predictions.push({
                category: "Stress Management",
                prediction: "Performance may decline in high-pressure situations",
                confidence: "Medium"
            });
        }

        // Leadership Potential
        if (scoreMap.influence_style >= 75 && scoreMap.achievement_drive >= 75) {
            predictions.push({
                category: "Leadership",
                prediction: "Strong potential for leadership roles and team management",
                confidence: "High"
            });
        }

        // Innovation and Problem Solving
        if (scoreMap.cognitive_flexibility >= 75 && scoreMap.systems_thinking >= 70) {
            predictions.push({
                category: "Innovation",
                prediction: "Will bring creative solutions and strategic insights to challenges",
                confidence: "High"
            });
        }

        // Sales Performance
        if (scoreMap.achievement_drive >= 75 && scoreMap.influence_style >= 70 && scoreMap.relationship_building >= 70) {
            predictions.push({
                category: "Sales Performance",
                prediction: "High potential for exceeding sales targets and client acquisition",
                confidence: "High"
            });
        }

        return predictions;
    }

    analyzeCommunicationStyle(scores, frameworkMappings) {
        const scoreMap = this.createScoreMap(scores);
        const mbti = frameworkMappings.find(m => m.framework === 'MBTI')?.result || '';
        const disc = frameworkMappings.find(m => m.framework === 'DISC')?.result || '';
        
        const style = {
            preferred_style: "",
            communication_tips: [],
            potential_challenges: [],
            best_approach: ""
        };

        // Determine preferred style
        if (scoreMap.social_calibration >= 70 && scoreMap.relationship_building >= 70) {
            style.preferred_style = "Warm and personable, values relationship-building in communication";
        } else if (scoreMap.systems_thinking >= 70 && scoreMap.achievement_drive >= 70) {
            style.preferred_style = "Direct and results-oriented, prefers efficient, goal-focused communication";
        } else if (scoreMap.cognitive_flexibility >= 70 && scoreMap.learning_orientation >= 70) {
            style.preferred_style = "Exploratory and conceptual, enjoys discussing ideas and possibilities";
        } else {
            style.preferred_style = "Balanced and adaptable communication style";
        }

        // Add DISC-based insights
        if (disc === 'D') {
            style.communication_tips.push("Be direct and to the point");
            style.communication_tips.push("Focus on results and bottom line");
            style.communication_tips.push("Avoid excessive details unless requested");
        } else if (disc === 'I') {
            style.communication_tips.push("Allow time for social interaction");
            style.communication_tips.push("Be enthusiastic and positive");
            style.communication_tips.push("Recognize achievements publicly");
        } else if (disc === 'S') {
            style.communication_tips.push("Be patient and supportive");
            style.communication_tips.push("Provide clear expectations");
            style.communication_tips.push("Avoid sudden changes without explanation");
        } else if (disc === 'C') {
            style.communication_tips.push("Provide detailed information and data");
            style.communication_tips.push("Be prepared with facts and logic");
            style.communication_tips.push("Allow time for analysis and questions");
        }

        // Add MBTI-based insights
        if (mbti.includes('E')) {
            style.communication_tips.push("Prefers verbal communication and brainstorming");
        } else if (mbti.includes('I')) {
            style.communication_tips.push("Prefers written communication and time to process");
        }

        if (mbti.includes('T')) {
            style.communication_tips.push("Responds well to logical arguments and objective criteria");
        } else if (mbti.includes('F')) {
            style.communication_tips.push("Values empathy and consideration of personal impact");
        }

        // Identify challenges
        if (scoreMap.emotional_regulation < 50) {
            style.potential_challenges.push("May become defensive when receiving criticism");
        }
        if (scoreMap.social_calibration < 50) {
            style.potential_challenges.push("Might miss nonverbal cues or social nuances");
        }
        if (scoreMap.influence_style < 50) {
            style.potential_challenges.push("May struggle to assert opinions in group settings");
        }

        // Best approach
        if (scoreMap.learning_orientation >= 70) {
            style.best_approach = "Frame feedback as learning opportunities and growth potential";
        } else if (scoreMap.achievement_drive >= 70) {
            style.best_approach = "Connect communication to goals and measurable outcomes";
        } else if (scoreMap.relationship_building >= 70) {
            style.best_approach = "Build rapport before addressing challenging topics";
        } else {
            style.best_approach = "Use clear, structured communication with specific examples";
        }

        return style;
    }

    analyzeWorkStyle(scores) {
        const scoreMap = this.createScoreMap(scores);
        const workStyle = {
            pace: "",
            environment: "",
            motivation: "",
            strengths: [],
            optimal_conditions: []
        };

        // Determine pace
        if (scoreMap.achievement_drive >= 75 && scoreMap.self_management >= 70) {
            workStyle.pace = "Fast-paced and deadline-driven";
        } else if (scoreMap.systems_thinking >= 75 && scoreMap.cognitive_flexibility >= 70) {
            workStyle.pace = "Methodical with bursts of creative intensity";
        } else if (scoreMap.self_management < 50) {
            workStyle.pace = "Variable, may need external structure";
        } else {
            workStyle.pace = "Steady and consistent";
        }

        // Determine environment
        if (scoreMap.collaborative_intelligence >= 75) {
            workStyle.environment = "Thrives in collaborative, team-based settings";
        } else if (scoreMap.collaborative_intelligence < 50 && scoreMap.self_management >= 70) {
            workStyle.environment = "Prefers independent work with minimal supervision";
        } else {
            workStyle.environment = "Adaptable to both team and individual work";
        }

        // Determine motivation
        if (scoreMap.achievement_drive >= 80) {
            workStyle.motivation = "Driven by goals, competition, and recognition";
        } else if (scoreMap.learning_orientation >= 80) {
            workStyle.motivation = "Motivated by learning, growth, and new challenges";
        } else if (scoreMap.relationship_building >= 80) {
            workStyle.motivation = "Inspired by helping others and building relationships";
        } else if (scoreMap.ethical_reasoning >= 80) {
            workStyle.motivation = "Motivated by purpose and making a positive impact";
        } else {
            workStyle.motivation = "Balanced motivation from multiple sources";
        }

        // Identify strengths
        if (scoreMap.self_management >= 75) {
            workStyle.strengths.push("Excellent time management and organization");
        }
        if (scoreMap.systems_thinking >= 75) {
            workStyle.strengths.push("Strong analytical and problem-solving abilities");
        }
        if (scoreMap.cognitive_flexibility >= 75) {
            workStyle.strengths.push("Adaptable and creative in approach");
        }
        if (scoreMap.influence_style >= 75) {
            workStyle.strengths.push("Natural leadership and influence");
        }

        // Optimal conditions
        if (scoreMap.learning_orientation >= 70) {
            workStyle.optimal_conditions.push("Access to training and development opportunities");
        }
        if (scoreMap.achievement_drive >= 70) {
            workStyle.optimal_conditions.push("Clear goals and performance metrics");
        }
        if (scoreMap.collaborative_intelligence >= 70) {
            workStyle.optimal_conditions.push("Regular team interaction and collaboration");
        }
        if (scoreMap.risk_tolerance >= 70) {
            workStyle.optimal_conditions.push("Freedom to experiment and innovate");
        }

        return workStyle;
    }

    predictTeamDynamics(scores) {
        const scoreMap = this.createScoreMap(scores);
        const dynamics = {
            role_tendency: "",
            contribution_style: "",
            potential_conflicts: [],
            team_value: ""
        };

        // Determine role tendency
        if (scoreMap.influence_style >= 75 && scoreMap.achievement_drive >= 75) {
            dynamics.role_tendency = "Natural leader who will take charge of team initiatives";
        } else if (scoreMap.collaborative_intelligence >= 75 && scoreMap.emotional_regulation >= 75) {
            dynamics.role_tendency = "Team harmonizer who builds bridges and resolves conflicts";
        } else if (scoreMap.systems_thinking >= 75 && scoreMap.cognitive_flexibility >= 75) {
            dynamics.role_tendency = "Strategic thinker who provides innovative solutions";
        } else if (scoreMap.self_management >= 75 && scoreMap.ethical_reasoning >= 75) {
            dynamics.role_tendency = "Reliable executor who ensures quality and compliance";
        } else {
            dynamics.role_tendency = "Flexible team member who adapts to team needs";
        }

        // Contribution style
        if (scoreMap.learning_orientation >= 70) {
            dynamics.contribution_style = "Brings new ideas and keeps team updated on trends";
        } else if (scoreMap.relationship_building >= 70) {
            dynamics.contribution_style = "Strengthens team bonds and external relationships";
        } else if (scoreMap.achievement_drive >= 70) {
            dynamics.contribution_style = "Drives team performance and maintains focus on goals";
        } else {
            dynamics.contribution_style = "Consistent contributor across various team needs";
        }

        // Potential conflicts
        if (scoreMap.collaborative_intelligence < 50) {
            dynamics.potential_conflicts.push("May struggle with team consensus-building");
        }
        if (scoreMap.emotional_regulation < 50) {
            dynamics.potential_conflicts.push("Could create tension during stressful periods");
        }
        if (scoreMap.achievement_drive >= 85 && scoreMap.collaborative_intelligence < 60) {
            dynamics.potential_conflicts.push("May prioritize individual success over team goals");
        }

        // Team value
        const topScores = scores.sort((a, b) => b.score - a.score).slice(0, 2);
        dynamics.team_value = `Will add greatest value through ${topScores.map(s => this.dimensionDescriptions[s.dimension]).join(' and ')}`;

        return dynamics;
    }

    identifyRiskFactors(scores) {
        const risks = [];
        const scoreMap = this.createScoreMap(scores);

        // Critical risks (scores below 40)
        if (scoreMap.ethical_reasoning < 40) {
            risks.push({
                level: "HIGH",
                factor: "Ethical Reasoning",
                description: "May struggle with ethical decision-making in complex situations",
                mitigation: "Provide clear ethical guidelines and close supervision initially"
            });
        }

        if (scoreMap.emotional_regulation < 40) {
            risks.push({
                level: "HIGH",
                factor: "Emotional Regulation",
                description: "High risk of burnout or inappropriate responses under stress",
                mitigation: "Implement stress management support and regular check-ins"
            });
        }

        if (scoreMap.self_management < 40) {
            risks.push({
                level: "HIGH",
                factor: "Self Management",
                description: "May struggle to meet deadlines or manage multiple priorities",
                mitigation: "Provide structured oversight and project management tools"
            });
        }

        // Moderate risks (scores below 50)
        if (scoreMap.relationship_building < 50 && scoreMap.social_calibration < 50) {
            risks.push({
                level: "MEDIUM",
                factor: "Client Relations",
                description: "May struggle to build and maintain client relationships",
                mitigation: "Pair with experienced advisors and provide relationship training"
            });
        }

        if (scoreMap.achievement_drive < 50) {
            risks.push({
                level: "MEDIUM",
                factor: "Performance Drive",
                description: "May lack the competitive drive needed for sales success",
                mitigation: "Set incremental goals and provide regular motivation coaching"
            });
        }

        if (scoreMap.learning_orientation < 50) {
            risks.push({
                level: "MEDIUM",
                factor: "Adaptability",
                description: "May resist new processes or industry changes",
                mitigation: "Provide structured training with clear benefits explained"
            });
        }

        // Combination risks
        if (scoreMap.risk_tolerance >= 85 && scoreMap.ethical_reasoning < 60) {
            risks.push({
                level: "MEDIUM",
                factor: "Decision Making",
                description: "May take excessive risks without considering ethical implications",
                mitigation: "Establish clear risk parameters and decision escalation processes"
            });
        }

        if (scoreMap.achievement_drive >= 85 && scoreMap.collaborative_intelligence < 50) {
            risks.push({
                level: "MEDIUM",
                factor: "Team Dynamics",
                description: "Highly competitive nature may disrupt team cohesion",
                mitigation: "Channel competitive drive toward external goals, not internal competition"
            });
        }

        return risks.sort((a, b) => {
            const levelOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return levelOrder[a.level] - levelOrder[b.level];
        });
    }

    generateRecommendations(scores) {
        const recommendations = {
            immediate_actions: [],
            development_priorities: [],
            role_fit: [],
            management_approach: []
        };

        const scoreMap = this.createScoreMap(scores);
        const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

        // Immediate actions based on overall profile
        if (avgScore >= 75) {
            recommendations.immediate_actions.push("Fast-track this candidate through the interview process");
            recommendations.immediate_actions.push("Consider for leadership development program");
        } else if (avgScore >= 65) {
            recommendations.immediate_actions.push("Proceed with standard interview process");
            recommendations.immediate_actions.push("Identify specific role matches based on strengths");
        } else {
            recommendations.immediate_actions.push("Conduct additional screening interview");
            recommendations.immediate_actions.push("Clearly define development expectations");
        }

        // Development priorities
        const weakestDimensions = scores
            .sort((a, b) => a.score - b.score)
            .slice(0, 3)
            .filter(s => s.score < 70);

        weakestDimensions.forEach(dim => {
            recommendations.development_priorities.push({
                dimension: dim.dimension,
                priority: dim.score < 50 ? "HIGH" : "MEDIUM",
                action: this.generateDevelopmentRecommendation(dim.dimension)
            });
        });

        // Role fit recommendations
        if (scoreMap.relationship_building >= 75 && scoreMap.influence_style >= 70) {
            recommendations.role_fit.push("Excellent fit for client-facing advisory roles");
        }
        if (scoreMap.systems_thinking >= 75 && scoreMap.self_management >= 75) {
            recommendations.role_fit.push("Strong fit for analytical or strategic planning roles");
        }
        if (scoreMap.collaborative_intelligence >= 75 && scoreMap.emotional_regulation >= 75) {
            recommendations.role_fit.push("Ideal for team leadership or mentorship positions");
        }
        if (scoreMap.achievement_drive >= 80 && scoreMap.risk_tolerance >= 70) {
            recommendations.role_fit.push("Perfect for business development or sales roles");
        }

        // Management approach
        if (scoreMap.learning_orientation >= 70) {
            recommendations.management_approach.push("Provide continuous learning opportunities and challenges");
        }
        if (scoreMap.achievement_drive >= 70) {
            recommendations.management_approach.push("Set clear, ambitious goals with regular performance feedback");
        }
        if (scoreMap.collaborative_intelligence >= 70) {
            recommendations.management_approach.push("Include in team projects and collaborative initiatives");
        }
        if (scoreMap.self_management < 60) {
            recommendations.management_approach.push("Provide structured oversight and regular check-ins");
        }
        if (scoreMap.emotional_regulation < 60) {
            recommendations.management_approach.push("Monitor stress levels and provide support resources");
        }

        return recommendations;
    }

    calculateCulturalFit(scores) {
        const scoreMap = this.createScoreMap(scores);
        
        // Northwestern Mutual values: Integrity, Collaboration, Excellence, Respect
        const culturalDimensions = {
            integrity: scoreMap.ethical_reasoning * 0.3,
            collaboration: scoreMap.collaborative_intelligence * 0.25,
            excellence: scoreMap.achievement_drive * 0.25,
            respect: scoreMap.social_calibration * 0.2
        };

        const culturalFitScore = Math.round(
            culturalDimensions.integrity +
            culturalDimensions.collaboration +
            culturalDimensions.excellence +
            culturalDimensions.respect
        );

        return Math.min(100, Math.max(0, culturalFitScore));
    }

    calculateRoleFit(scores) {
        const scoreMap = this.createScoreMap(scores);
        
        const roleFits = {
            financial_advisor: this.calculateAdvisorFit(scoreMap),
            team_leader: this.calculateLeaderFit(scoreMap),
            analyst: this.calculateAnalystFit(scoreMap),
            business_development: this.calculateBizDevFit(scoreMap),
            client_service: this.calculateServiceFit(scoreMap)
        };

        return roleFits;
    }

    calculateAdvisorFit(scoreMap) {
        const fit = (
            scoreMap.relationship_building * 0.25 +
            scoreMap.ethical_reasoning * 0.20 +
            scoreMap.influence_style * 0.15 +
            scoreMap.achievement_drive * 0.15 +
            scoreMap.social_calibration * 0.15 +
            scoreMap.emotional_regulation * 0.10
        );
        return Math.round(fit);
    }

    calculateLeaderFit(scoreMap) {
        const fit = (
            scoreMap.influence_style * 0.25 +
            scoreMap.collaborative_intelligence * 0.20 +
            scoreMap.emotional_regulation * 0.15 +
            scoreMap.systems_thinking * 0.15 +
            scoreMap.achievement_drive * 0.15 +
            scoreMap.ethical_reasoning * 0.10
        );
        return Math.round(fit);
    }

    calculateAnalystFit(scoreMap) {
        const fit = (
            scoreMap.systems_thinking * 0.30 +
            scoreMap.self_management * 0.25 +
            scoreMap.cognitive_flexibility * 0.20 +
            scoreMap.learning_orientation * 0.15 +
            scoreMap.achievement_drive * 0.10
        );
        return Math.round(fit);
    }

    calculateBizDevFit(scoreMap) {
        const fit = (
            scoreMap.achievement_drive * 0.25 +
            scoreMap.relationship_building * 0.20 +
            scoreMap.influence_style * 0.20 +
            scoreMap.risk_tolerance * 0.15 +
            scoreMap.cognitive_flexibility * 0.10 +
            scoreMap.social_calibration * 0.10
        );
        return Math.round(fit);
    }

    calculateServiceFit(scoreMap) {
        const fit = (
            scoreMap.relationship_building * 0.25 +
            scoreMap.emotional_regulation * 0.20 +
            scoreMap.social_calibration * 0.20 +
            scoreMap.collaborative_intelligence * 0.15 +
            scoreMap.self_management * 0.10 +
            scoreMap.ethical_reasoning * 0.10
        );
        return Math.round(fit);
    }

    createScoreMap(scores) {
        const map = {};
        scores.forEach(s => {
            map[s.dimension] = parseFloat(s.score);
        });
        return map;
    }
}

module.exports = new IntelligenceService();
