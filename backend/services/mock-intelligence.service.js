/**
 * MOCK INTELLIGENCE SERVICE
 * Provides realistic behavioral assessment data and candidate intelligence
 * for demonstration and testing purposes.
 */

class MockIntelligenceService {
  generateCandidateIntelligence(candidateId) {
    return {
      overallAssessment: {
        score: Math.floor(Math.random() * 30) + 70,
        faFitScore: Math.floor(Math.random() * 25) + 75,
        riskLevel: ['LOW', 'MEDIUM'][Math.floor(Math.random() * 2)],
        recommendation: 'STRONG HIRE',
        summary: 'This candidate demonstrates exceptional potential for success as a Financial Advisor. Strong behavioral indicators across all key dimensions with particularly impressive scores in client relationship building and resilience.'
      },
      personality: {
        mbti: ['ENTJ', 'ENFJ', 'ESTJ', 'ISTJ'][Math.floor(Math.random() * 4)],
        disc: ['D', 'DI', 'ID', 'S'][Math.floor(Math.random() * 4)],
        enneagram: `Type ${Math.floor(Math.random() * 9) + 1}`
      },
      behavioralDimensions: {
        achievementDrive: Math.floor(Math.random() * 20) + 80,
        clientFocus: Math.floor(Math.random() * 20) + 80,
        resilience: Math.floor(Math.random() * 25) + 75,
        communicationSkills: Math.floor(Math.random() * 20) + 80,
        learningAgility: Math.floor(Math.random() * 30) + 70,
        collaboration: Math.floor(Math.random() * 25) + 75,
        integrity: Math.floor(Math.random() * 10) + 90,
        problemSolving: Math.floor(Math.random() * 25) + 75,
        adaptability: Math.floor(Math.random() * 20) + 80,
        goalOrientation: Math.floor(Math.random() * 15) + 85,
        relationshipBuilding: Math.floor(Math.random() * 20) + 80,
        initiative: Math.floor(Math.random() * 25) + 75
      },
      keyStrengths: [
        'Exceptional client relationship skills with proven track record',
        'High resilience and ability to handle rejection constructively',
        'Strong goal orientation with systematic achievement approach',
        'Natural leadership qualities and team collaboration',
        'Quick learner with high adaptability to change'
      ],
      growthAreas: [
        'Could benefit from advanced financial planning certification',
        'Opportunity to develop deeper technical product knowledge',
        'May need support in managing high-volume client base initially'
      ],
      predictions: {
        firstYearSuccess: '85%',
        threeYearRetention: '78%',
        clientSatisfaction: '92%',
        revenueGeneration: 'Above Average',
        teamContribution: 'High'
      },
      recommendations: {
        immediate: [
          'Fast-track for final interview with senior leadership',
          'Pair with top-performing FA for shadowing opportunity',
          'Include in next cohort of advanced training program'
        ],
        onboarding: [
          'Assign mentor from similar background',
          'Focus initial training on product knowledge',
          'Set aggressive but achievable first-quarter goals'
        ],
        longTerm: [
          'Consider for leadership development track',
          'Potential for specialized market segments',
          'Candidate for regional expansion opportunities'
        ]
      }
    };
  }

  generateAssessmentQuestions() {
    return {
      sections: [
        {
          title: 'Client Focus Assessment',
          questions: [
            {
              type: 'likert',
              question: 'I enjoy helping others achieve their financial goals',
              scale: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
            },
            {
              type: 'scenario',
              question: 'A client is upset about market volatility affecting their portfolio. How do you respond?',
              options: [
                'Provide detailed market analysis and historical context',
                'Listen empathetically and acknowledge their concerns first',
                'Immediately suggest portfolio adjustments',
                'Schedule an in-person meeting to review their goals'
              ]
            }
          ]
        },
        {
          title: 'Resilience & Drive',
          questions: [
            {
              type: 'ranking',
              question: 'Rank these motivators from most to least important to you:',
              items: [
                'Financial rewards',
                'Helping others succeed',
                'Personal growth',
                'Recognition and status',
                'Work-life balance'
              ]
            }
          ]
        }
      ]
    };
  }

  generatePipelineIntelligence() {
    return {
      overallMetrics: {
        totalCandidates: 234,
        avgAssessmentScore: 82,
        topCandidates: 47,
        completionRate: 89
      },
      stageAnalysis: [
        {
          stage: 'New Lead',
          count: 87,
          conversionRate: '35%',
          avgTimeInStage: '3 days',
          health: 'good',
          recommendations: ['Continue current sourcing strategy', 'Consider increasing volume by 15%']
        },
        {
          stage: 'Assessment',
          count: 42,
          conversionRate: '58%',
          avgTimeInStage: '12 days',
          health: 'warning',
          issues: ['42% incomplete rate', 'Extended time in stage'],
          recommendations: ['Implement automated reminders', 'Simplify assessment process']
        },
        {
          stage: 'Interview',
          count: 28,
          conversionRate: '75%',
          avgTimeInStage: '8 days',
          health: 'good',
          recommendations: ['Maintain current process', 'Consider panel interviews for top candidates']
        },
        {
          stage: 'Offer',
          count: 12,
          conversionRate: '92%',
          avgTimeInStage: '4 days',
          health: 'excellent',
          recommendations: ['Excellent performance', 'Consider expedited offers for top talent']
        }
      ],
      insights: {
        bottlenecks: ['Assessment completion', 'Interview scheduling'],
        opportunities: ['Increase top-of-funnel', 'Improve assessment experience'],
        predictions: ['15-20 hires in next 30 days', 'Pipeline should increase by 25%']
      }
    };
  }

  generateMarketIntelligence(location = 'philadelphia') {
    const marketData = {
      philadelphia: {
        talentAvailability: 'High',
        avgSalaryExpectation: '$68,000',
        competitionLevel: 'Moderate',
        topEmployers: ['Vanguard', 'Comcast', 'JPMorgan Chase'],
        sourcingRecommendations: [
          'Focus on financial services professionals seeking career change',
          'Target sales professionals in adjacent industries',
          'Leverage university partnerships in the region'
        ]
      },
      chicago: {
        talentAvailability: 'Very High',
        avgSalaryExpectation: '$72,000',
        competitionLevel: 'High',
        topEmployers: ['Allstate', 'Abbott', 'Boeing'],
        sourcingRecommendations: [
          'Competitive market requires premium positioning',
          'Emphasize Northwestern Mutual\'s training and development',
          'Consider sign-on bonuses for top talent'
        ]
      }
    };

    return marketData[location.toLowerCase()] || marketData.philadelphia;
  }

  generateSourcedCandidates(count = 10) {
    const candidates = [];
    const companies = ['Prudential', 'MetLife', 'AIG', 'State Farm', 'Allstate', 'Travelers', 'Liberty Mutual'];
    const titles = ['Sales Representative', 'Account Manager', 'Business Development', 'Client Specialist'];
    const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

      candidates.push({
        id: `sourced-${i + 1}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${companies[i % companies.length].toLowerCase().replace(/\s+/g, '')}.com`,
        currentTitle: titles[Math.floor(Math.random() * titles.length)],
        currentCompany: companies[i % companies.length],
        location: 'Philadelphia, PA',
        linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
        experience: Math.floor(Math.random() * 10) + 2,
        skills: ['Sales', 'Client Relations', 'Insurance', 'Financial Services'],
        sourceScore: Math.floor(Math.random() * 30) + 70,
        contactInfo: {
          phone: `(215) 555-${String(1000 + i).padStart(4, '0')}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`
        },
        sourcing: {
          method: ['LinkedIn', 'Indeed', 'Referral'][Math.floor(Math.random() * 3)],
          confidence: ['High', 'Medium', 'High'][Math.floor(Math.random() * 3)],
          notes: 'Strong background in financial services with excellent client management experience'
        }
      });
    }

    return candidates;
  }
}

module.exports = new MockIntelligenceService();