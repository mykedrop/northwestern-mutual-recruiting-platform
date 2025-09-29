const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/**
 * GET /api/assessment-questions
 * Get all assessment questions with their answer options and dimension mapping
 */
router.get('/', auth, async (req, res) => {
  try {
    // Northwestern Mutual's 27-Question Behavioral Assessment
    const assessmentQuestions = {
      metadata: {
        totalQuestions: 27,
        dimensions: 12,
        estimatedTime: "15-20 minutes",
        scoringMethod: "Multi-dimensional weighted scoring with personality profiling"
      },
      dimensions: {
        achievementDrive: {
          name: "Achievement Drive",
          description: "Drive to succeed and exceed goals",
          weight: 0.15,
          faWeight: 0.20,
          questions: ["q1", "q5", "q12", "q18", "q24"],
          keywords: ["achieve", "succeed", "goal", "exceed", "win"]
        },
        clientFocus: {
          name: "Client Focus",
          description: "Dedication to understanding and serving client needs",
          weight: 0.15,
          faWeight: 0.18,
          questions: ["q2", "q7", "q13", "q19", "q25"],
          keywords: ["client", "service", "help", "needs", "satisfaction"]
        },
        resilience: {
          name: "Resilience",
          description: "Ability to bounce back from setbacks and rejection",
          weight: 0.12,
          faWeight: 0.16,
          questions: ["q3", "q8", "q14", "q20", "q26"],
          keywords: ["overcome", "persist", "recover", "tough", "challenge"]
        },
        communicationSkills: {
          name: "Communication Skills",
          description: "Effectiveness in verbal and written communication",
          weight: 0.12,
          faWeight: 0.14,
          questions: ["q4", "q9", "q15", "q21", "q27"],
          keywords: ["explain", "listen", "present", "understand", "clear"]
        },
        learningAgility: {
          name: "Learning Agility",
          description: "Speed and effectiveness of learning new concepts",
          weight: 0.10,
          faWeight: 0.08,
          questions: ["q6", "q11", "q16", "q22"],
          keywords: ["learn", "adapt", "grow", "study", "develop"]
        },
        collaboration: {
          name: "Collaboration",
          description: "Ability to work effectively with teams",
          weight: 0.08,
          faWeight: 0.06,
          questions: ["q10", "q17", "q23"],
          keywords: ["team", "together", "cooperate", "support", "share"]
        }
      },
      questions: [
        {
          id: "q1",
          dimension: "achievementDrive",
          type: "likert_scale",
          question: "I am motivated by challenging goals and high performance standards.",
          description: "Measures intrinsic achievement motivation and goal orientation",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Does not align with my approach" },
            { value: 2, label: "Disagree", description: "Somewhat does not align" },
            { value: 3, label: "Neutral", description: "Neither agree nor disagree" },
            { value: 4, label: "Agree", description: "Generally aligns with my approach" },
            { value: 5, label: "Strongly Agree", description: "Completely aligns with my approach" }
          ],
          scoring: "Higher scores indicate stronger achievement drive",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q2",
          dimension: "clientFocus",
          type: "scenario_choice",
          question: "A client expresses frustration with a financial product recommendation. Your first priority is to:",
          description: "Evaluates client service orientation and problem-solving approach",
          options: [
            { value: 1, label: "Explain why the recommendation is still valid", description: "Focus on product justification" },
            { value: 2, label: "Ask detailed questions to understand their concerns", description: "Prioritize client understanding" },
            { value: 3, label: "Offer alternative product options immediately", description: "Quick solution approach" },
            { value: 4, label: "Schedule a follow-up meeting to discuss in detail", description: "Structured problem-solving" },
            { value: 5, label: "Listen fully, acknowledge concerns, then collaborate on solutions", description: "Client-centered approach" }
          ],
          scoring: "Highest scores for client-centered listening and collaboration",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q3",
          dimension: "resilience",
          type: "likert_scale",
          question: "When facing rejection or setbacks, I quickly refocus and move forward.",
          description: "Assesses emotional resilience and recovery from adversity",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Takes significant time to recover" },
            { value: 2, label: "Disagree", description: "Usually takes time to bounce back" },
            { value: 3, label: "Neutral", description: "Sometimes quick, sometimes not" },
            { value: 4, label: "Agree", description: "Generally bounce back quickly" },
            { value: 5, label: "Strongly Agree", description: "Always resilient and forward-focused" }
          ],
          scoring: "Higher scores indicate stronger resilience",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q4",
          dimension: "communicationSkills",
          type: "priority_ranking",
          question: "Rank these communication skills in order of importance for financial advisory success:",
          description: "Tests understanding of effective financial advisory communication",
          options: [
            { value: 1, label: "Active listening to client needs", description: "Understanding client perspective" },
            { value: 2, label: "Clear explanation of complex concepts", description: "Simplifying financial information" },
            { value: 3, label: "Persuasive presentation skills", description: "Influencing client decisions" },
            { value: 4, label: "Written follow-up and documentation", description: "Professional correspondence" },
            { value: 5, label: "Empathetic emotional communication", description: "Connecting on personal level" }
          ],
          scoring: "Scoring based on research-backed importance hierarchy",
          timeEstimate: "90-120 seconds"
        },
        {
          id: "q5",
          dimension: "achievementDrive",
          type: "likert_scale",
          question: "I consistently set ambitious targets that stretch my capabilities.",
          description: "Measures goal-setting behavior and growth orientation",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Prefer safer, achievable goals" },
            { value: 2, label: "Disagree", description: "Usually set moderate goals" },
            { value: 3, label: "Neutral", description: "Mix of ambitious and safe goals" },
            { value: 4, label: "Agree", description: "Often set challenging goals" },
            { value: 5, label: "Strongly Agree", description: "Always push boundaries with goals" }
          ],
          scoring: "Higher scores indicate stronger achievement drive",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q6",
          dimension: "learningAgility",
          type: "scenario_choice",
          question: "Northwestern Mutual introduces a new financial planning software. Your approach to mastering it would be:",
          description: "Evaluates learning strategy and adaptability to new tools",
          options: [
            { value: 1, label: "Wait for formal training sessions", description: "Structured learning approach" },
            { value: 2, label: "Ask colleagues for tips and guidance", description: "Collaborative learning" },
            { value: 3, label: "Experiment with the software independently", description: "Self-directed exploration" },
            { value: 4, label: "Study documentation thoroughly first", description: "Research-based learning" },
            { value: 5, label: "Combine multiple approaches: training, practice, and peer learning", description: "Comprehensive learning strategy" }
          ],
          scoring: "Highest scores for comprehensive, proactive learning",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q7",
          dimension: "clientFocus",
          type: "likert_scale",
          question: "I genuinely enjoy helping people solve their financial challenges.",
          description: "Measures intrinsic service motivation",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Primarily motivated by other factors" },
            { value: 2, label: "Disagree", description: "Somewhat enjoys helping but not primary drive" },
            { value: 3, label: "Neutral", description: "Helping people is okay" },
            { value: 4, label: "Agree", description: "Genuinely enjoys helping people" },
            { value: 5, label: "Strongly Agree", description: "Deep satisfaction from helping others" }
          ],
          scoring: "Higher scores indicate stronger client service orientation",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q8",
          dimension: "resilience",
          type: "scenario_choice",
          question: "You've had a particularly difficult week with three client rejections. Your weekend approach is:",
          description: "Tests stress management and recovery strategies",
          options: [
            { value: 1, label: "Avoid thinking about work completely", description: "Avoidance strategy" },
            { value: 2, label: "Analyze what went wrong and plan improvements", description: "Reflective problem-solving" },
            { value: 3, label: "Seek support from colleagues or mentors", description: "Social support approach" },
            { value: 4, label: "Focus on relaxation and self-care activities", description: "Recovery and restoration" },
            { value: 5, label: "Balance reflection, planning, and restoration", description: "Comprehensive resilience approach" }
          ],
          scoring: "Highest scores for balanced, comprehensive approaches",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q9",
          dimension: "communicationSkills",
          type: "likert_scale",
          question: "I can effectively explain complex financial concepts in simple terms.",
          description: "Assesses ability to simplify and communicate complex information",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Struggle with simplification" },
            { value: 2, label: "Disagree", description: "Sometimes difficult to simplify" },
            { value: 3, label: "Neutral", description: "Average at simplifying concepts" },
            { value: 4, label: "Agree", description: "Usually good at simplification" },
            { value: 5, label: "Strongly Agree", description: "Excellent at making complex simple" }
          ],
          scoring: "Higher scores indicate stronger communication ability",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q10",
          dimension: "collaboration",
          type: "priority_ranking",
          question: "In a team project to develop new client onboarding processes, rank your preferred contributions:",
          description: "Evaluates team collaboration style and preferred role",
          options: [
            { value: 1, label: "Research best practices and industry standards", description: "Information gathering role" },
            { value: 2, label: "Facilitate team meetings and coordinate efforts", description: "Leadership and coordination" },
            { value: 3, label: "Design creative solutions and innovative approaches", description: "Creative problem-solving" },
            { value: 4, label: "Ensure quality standards and attention to detail", description: "Quality assurance role" },
            { value: 5, label: "Build consensus and manage team relationships", description: "Relationship management" }
          ],
          scoring: "Balanced scoring reflecting different valuable team contributions",
          timeEstimate: "90-120 seconds"
        },
        {
          id: "q11",
          dimension: "learningAgility",
          type: "likert_scale",
          question: "I actively seek feedback to improve my performance.",
          description: "Measures growth mindset and continuous improvement orientation",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Rarely seek feedback" },
            { value: 2, label: "Disagree", description: "Occasionally seek feedback" },
            { value: 3, label: "Neutral", description: "Sometimes seek feedback" },
            { value: 4, label: "Agree", description: "Regularly seek feedback" },
            { value: 5, label: "Strongly Agree", description: "Constantly seek feedback for growth" }
          ],
          scoring: "Higher scores indicate stronger learning agility",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q12",
          dimension: "achievementDrive",
          type: "scenario_choice",
          question: "Your annual performance review shows you're meeting all targets. Your response is:",
          description: "Tests drive for continuous improvement and excellence",
          options: [
            { value: 1, label: "Feel satisfied with meeting expectations", description: "Satisfaction with baseline performance" },
            { value: 2, label: "Ask what you could do to exceed targets next year", description: "Future improvement focus" },
            { value: 3, label: "Compare your performance with top performers", description: "Competitive benchmarking" },
            { value: 4, label: "Set higher personal goals for the following year", description: "Self-directed goal elevation" },
            { value: 5, label: "Develop a comprehensive plan to exceed all targets", description: "Strategic excellence approach" }
          ],
          scoring: "Highest scores for proactive excellence and strategic planning",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q13",
          dimension: "clientFocus",
          type: "matrix_grid",
          question: "Rate the importance of these client service aspects for Northwestern Mutual success:",
          description: "Evaluates understanding of comprehensive client service",
          options: [
            {
              aspects: [
                "Understanding individual client goals",
                "Providing ongoing financial education",
                "Maintaining regular communication",
                "Offering comprehensive product solutions",
                "Building long-term trusted relationships"
              ],
              scale: [
                { value: 1, label: "Not Important" },
                { value: 2, label: "Slightly Important" },
                { value: 3, label: "Moderately Important" },
                { value: 4, label: "Very Important" },
                { value: 5, label: "Extremely Important" }
              ]
            }
          ],
          scoring: "Higher average scores indicate stronger client focus understanding",
          timeEstimate: "120-180 seconds"
        },
        {
          id: "q14",
          dimension: "resilience",
          type: "scenario_choice",
          question: "After receiving harsh feedback from a manager, your typical response is:",
          description: "Measures emotional resilience and constructive response to criticism",
          options: [
            { value: 1, label: "Feel discouraged and question your abilities", description: "Emotional impact focus" },
            { value: 2, label: "Defend your actions and explain the reasoning", description: "Defensive response" },
            { value: 3, label: "Accept the feedback and ask for improvement suggestions", description: "Growth-oriented response" },
            { value: 4, label: "Thank them and create an action plan for improvement", description: "Proactive improvement" },
            { value: 5, label: "Welcome the feedback as a growth opportunity", description: "Resilient growth mindset" }
          ],
          scoring: "Higher scores for resilient, growth-oriented responses",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q15",
          dimension: "communicationSkills",
          type: "scenario_choice",
          question: "When explaining a complex insurance product to a client, you would:",
          description: "Tests ability to communicate complex concepts clearly",
          options: [
            { value: 1, label: "Use industry terminology to demonstrate expertise", description: "Technical expertise focus" },
            { value: 2, label: "Provide detailed written materials for review", description: "Documentation approach" },
            { value: 3, label: "Use simple analogies and real-life examples", description: "Simplification strategy" },
            { value: 4, label: "Ask questions to understand their current knowledge level first", description: "Audience assessment" },
            { value: 5, label: "Combine simple explanations with interactive examples", description: "Multi-modal communication" }
          ],
          scoring: "Highest scores for clear, audience-appropriate communication",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q16",
          dimension: "learningAgility",
          type: "likert_scale",
          question: "I enjoy learning about new financial products and market trends.",
          description: "Measures intrinsic learning motivation in financial services",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Prefer familiar products and approaches" },
            { value: 2, label: "Disagree", description: "Limited interest in new developments" },
            { value: 3, label: "Neutral", description: "Moderate interest in learning" },
            { value: 4, label: "Agree", description: "Enjoy staying current with industry" },
            { value: 5, label: "Strongly Agree", description: "Passionate about continuous learning" }
          ],
          scoring: "Higher scores indicate stronger learning agility",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q17",
          dimension: "collaboration",
          type: "scenario_choice",
          question: "Your team is struggling to meet quarterly targets. Your approach would be:",
          description: "Evaluates collaborative problem-solving and team support",
          options: [
            { value: 1, label: "Focus intensely on your individual performance", description: "Individual focus approach" },
            { value: 2, label: "Offer to share successful strategies with teammates", description: "Knowledge sharing" },
            { value: 3, label: "Suggest team meetings to identify collective solutions", description: "Collaborative problem-solving" },
            { value: 4, label: "Volunteer to help struggling team members", description: "Direct support approach" },
            { value: 5, label: "Organize team strategy sessions and mutual accountability", description: "Leadership collaboration" }
          ],
          scoring: "Highest scores for proactive, supportive collaboration",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q18",
          dimension: "achievementDrive",
          type: "likert_scale",
          question: "I am most satisfied when I exceed my performance targets.",
          description: "Measures satisfaction derived from high achievement",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Satisfaction from other sources" },
            { value: 2, label: "Disagree", description: "Meeting targets is sufficient" },
            { value: 3, label: "Neutral", description: "Mixed sources of satisfaction" },
            { value: 4, label: "Agree", description: "Exceeding targets brings satisfaction" },
            { value: 5, label: "Strongly Agree", description: "Greatest satisfaction from exceeding goals" }
          ],
          scoring: "Higher scores indicate stronger achievement drive",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q19",
          dimension: "clientFocus",
          type: "priority_ranking",
          question: "Rank these client service priorities for Northwestern Mutual success:",
          description: "Tests understanding of client-centered service approach",
          options: [
            { value: 1, label: "Building long-term trusted relationships", description: "Relationship foundation" },
            { value: 2, label: "Understanding each client's unique financial goals", description: "Personalized service" },
            { value: 3, label: "Providing comprehensive financial education", description: "Client empowerment" },
            { value: 4, label: "Offering innovative product solutions", description: "Product innovation" },
            { value: 5, label: "Maintaining consistent follow-up communication", description: "Ongoing engagement" }
          ],
          scoring: "Scoring based on client-centered service research",
          timeEstimate: "90-120 seconds"
        },
        {
          id: "q20",
          dimension: "resilience",
          type: "likert_scale",
          question: "Setbacks and challenges motivate me to work harder.",
          description: "Assesses ability to derive motivation from adversity",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Setbacks are discouraging" },
            { value: 2, label: "Disagree", description: "Setbacks reduce motivation" },
            { value: 3, label: "Neutral", description: "Mixed response to setbacks" },
            { value: 4, label: "Agree", description: "Setbacks often increase motivation" },
            { value: 5, label: "Strongly Agree", description: "Setbacks always fuel harder work" }
          ],
          scoring: "Higher scores indicate stronger resilience",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q21",
          dimension: "communicationSkills",
          type: "scenario_choice",
          question: "During a client presentation, you notice signs of confusion. You would:",
          description: "Tests real-time communication adaptation and responsiveness",
          options: [
            { value: 1, label: "Continue with the planned presentation", description: "Structured approach" },
            { value: 2, label: "Pause and ask if they have questions", description: "Basic responsiveness" },
            { value: 3, label: "Stop and check their understanding of key points", description: "Comprehension check" },
            { value: 4, label: "Adjust your explanation style and pace", description: "Adaptive communication" },
            { value: 5, label: "Pause, assess understanding, and co-create clarity", description: "Collaborative communication" }
          ],
          scoring: "Highest scores for adaptive, responsive communication",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q22",
          dimension: "learningAgility",
          type: "scenario_choice",
          question: "Northwestern Mutual changes its commission structure. Your learning approach is:",
          description: "Evaluates adaptation to organizational changes",
          options: [
            { value: 1, label: "Wait for official training on the new structure", description: "Formal learning preference" },
            { value: 2, label: "Study the documentation to understand details", description: "Self-directed research" },
            { value: 3, label: "Discuss implications with experienced colleagues", description: "Peer learning approach" },
            { value: 4, label: "Model different scenarios to understand impact", description: "Applied learning" },
            { value: 5, label: "Combine research, peer input, and scenario planning", description: "Comprehensive learning strategy" }
          ],
          scoring: "Highest scores for comprehensive, proactive learning",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q23",
          dimension: "collaboration",
          type: "likert_scale",
          question: "I prefer working collaboratively rather than independently.",
          description: "Measures preference for collaborative work environments",
          options: [
            { value: 1, label: "Strongly Disagree", description: "Strong preference for independent work" },
            { value: 2, label: "Disagree", description: "Generally prefer working alone" },
            { value: 3, label: "Neutral", description: "Comfortable with both approaches" },
            { value: 4, label: "Agree", description: "Generally prefer collaboration" },
            { value: 5, label: "Strongly Agree", description: "Strong preference for teamwork" }
          ],
          scoring: "Higher scores indicate stronger collaboration preference",
          timeEstimate: "30-45 seconds"
        },
        {
          id: "q24",
          dimension: "achievementDrive",
          type: "scenario_choice",
          question: "You're offered two positions: one with guaranteed steady income, another with high potential but commission-based. You choose:",
          description: "Tests risk tolerance and achievement motivation in compensation",
          options: [
            { value: 1, label: "The steady income for financial security", description: "Security-focused choice" },
            { value: 2, label: "The commission role if the base is adequate", description: "Balanced risk approach" },
            { value: 3, label: "The commission role for the challenge and potential", description: "Achievement-motivated choice" },
            { value: 4, label: "The commission role after thoroughly analyzing the opportunity", description: "Calculated achievement approach" },
            { value: 5, label: "The commission role - high potential energizes me", description: "High achievement drive" }
          ],
          scoring: "Higher scores for achievement-oriented, growth-focused choices",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q25",
          dimension: "clientFocus",
          type: "scenario_choice",
          question: "A long-term client asks about a product that isn't optimal for their situation. You:",
          description: "Tests ethical client service and long-term relationship focus",
          options: [
            { value: 1, label: "Explain the product features as requested", description: "Direct response approach" },
            { value: 2, label: "Present the product with some reservations noted", description: "Balanced information sharing" },
            { value: 3, label: "Suggest alternative products that better fit their needs", description: "Client-centered recommendation" },
            { value: 4, label: "Explore their underlying needs before recommending", description: "Consultative approach" },
            { value: 5, label: "Prioritize their best interests even if it means no sale", description: "Ethical client advocacy" }
          ],
          scoring: "Highest scores for ethical, client-centered approaches",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q26",
          dimension: "resilience",
          type: "scenario_choice",
          question: "You experience a month with multiple client rejections and low sales. Your approach is:",
          description: "Tests sustained resilience under extended pressure",
          options: [
            { value: 1, label: "Take time off to recover and recharge", description: "Recovery-focused approach" },
            { value: 2, label: "Analyze what went wrong and adjust strategy", description: "Analytical improvement" },
            { value: 3, label: "Increase activity levels to improve numbers", description: "Volume-based response" },
            { value: 4, label: "Seek coaching and mentorship for improvement", description: "Support-seeking approach" },
            { value: 5, label: "Combine reflection, strategy adjustment, and increased effort", description: "Comprehensive resilience response" }
          ],
          scoring: "Highest scores for balanced, comprehensive resilience strategies",
          timeEstimate: "60-90 seconds"
        },
        {
          id: "q27",
          dimension: "communicationSkills",
          type: "matrix_grid",
          question: "Rate your confidence in these communication scenarios:",
          description: "Self-assessment of communication skills across contexts",
          options: [
            {
              scenarios: [
                "Presenting to large groups (20+ people)",
                "One-on-one client consultations",
                "Handling objections and difficult questions",
                "Written communication and follow-up",
                "Explaining complex financial concepts"
              ],
              scale: [
                { value: 1, label: "Not Confident" },
                { value: 2, label: "Slightly Confident" },
                { value: 3, label: "Moderately Confident" },
                { value: 4, label: "Very Confident" },
                { value: 5, label: "Extremely Confident" }
              ]
            }
          ],
          scoring: "Higher average scores indicate stronger communication confidence",
          timeEstimate: "120-180 seconds"
        }
      ]
    };

    res.json(assessmentQuestions);
  } catch (error) {
    console.error('Error getting assessment questions:', error);
    res.status(500).json({ error: 'Failed to get assessment questions' });
  }
});

module.exports = router;