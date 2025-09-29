// Elite Behavioral Assessment Engine
class EliteAssessmentEngine {
    constructor() {
        this.currentQuestion = 0;
        this.totalQuestions = 27;
        this.questionSequence = [];
        this.assessmentState = {
            status: 'initializing',
            startTime: null,
            endTime: null,
            responses: [],
            behavioralData: [],
            sessionId: null,
            candidateId: null
        };
        this.questionBank = [];
        this.behavioralAnalyzer = new BehavioralAnalyzer();
        this.dimensionalScorer = new DimensionalScorer();
        this.interactiveComponents = new InteractiveQuestionComponents();
        
        // Define the 12-dimensional behavioral framework
        this.ASSESSMENT_DIMENSIONS = {
            cognitive_flexibility: { weight: 0.09, description: "Adaptability and innovative thinking" },
            emotional_regulation: { weight: 0.09, description: "Stress management and composure" },
            social_calibration: { weight: 0.08, description: "Interpersonal awareness and adjustment" },
            achievement_drive: { weight: 0.09, description: "Goal orientation and persistence" },
            learning_orientation: { weight: 0.08, description: "Growth mindset and skill development" },
            risk_tolerance: { weight: 0.08, description: "Comfort with uncertainty and change" },
            relationship_building: { weight: 0.08, description: "Trust development and rapport" },
            ethical_reasoning: { weight: 0.08, description: "Moral judgment and integrity" },
            influence_style: { weight: 0.08, description: "Leadership and persuasion approach" },
            systems_thinking: { weight: 0.09, description: "Strategic and analytical perspective" },
            self_management: { weight: 0.09, description: "Organization and self-discipline" },
            collaborative_intelligence: { weight: 0.09, description: "Team effectiveness and cooperation" }
        };
        
        console.log('[EA] Initializing Elite Assessment Engine with 12-dimensional framework');
        this.initialize();
    }
    
    async initialize() {
        try {
            await this.loadQuestionBank();
            this.prepareAssessmentSequence();
            this.setupEventListeners();
            console.log('[EA] Initialization complete');
        } catch (error) {
            console.error('[EA] Initialization failed:', error);
        }
    }
    
    async loadQuestionBank() {
        try {
            const response = await fetch('/data/question-bank.json');
            const data = await response.json();
            this.questionBank = data.questions;
            console.log('[EA] Loaded', this.questionBank.length, 'questions');
        } catch (error) {
            console.error('[EA] Failed to load question bank:', error);
        }
    }
    
    prepareAssessmentSequence() {
        console.log('[EA] Preparing assessment sequence...');
        
        // Load all questions in order (they're already balanced in the JSON)
        this.questionSequence = [...this.questionBank];
        
        console.log('[EA] Question sequence prepared with', this.questionSequence.length, 'questions');
        console.log('[EA] First few questions:', this.questionSequence.slice(0, 3).map(q => ({id: q.id, type: q.type})));
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    setupEventListeners() {
        const startBtn = document.querySelector('.start-assessment-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startAssessment());
        }
    }
    
    startAssessment() {
        console.log('[EA] Starting assessment...');
        
        // Hide welcome screen
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
        
        // Show question container
        const questionContainer = document.getElementById('question-container');
        if (questionContainer) {
            questionContainer.style.display = 'block';
        }
        
        // Set assessment state
        this.assessmentState.status = 'in_progress';
        this.assessmentState.startTime = Date.now();
        
        // Start assessment timer
        this.startAssessmentTimer();
        
        // Load first question
        this.loadQuestion(0);
        
        console.log('[EA] Assessment started');
    }
    
    startAssessmentTimer() {
        // Clear any existing timer first
        if (this.assessmentTimer) {
            clearInterval(this.assessmentTimer);
            this.assessmentTimer = null;
        }
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) {
            console.warn('[EA:StartAssessmentTimer] Timer display not found');
            return;
        }
        let elapsedSeconds = 0;
        timerDisplay.textContent = '0:00';
        console.log('[EA:StartAssessmentTimer] Starting assessment timer');
        this.assessmentTimer = setInterval(() => {
            elapsedSeconds++;
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopAssessmentTimer() {
        if (this.assessmentTimer) {
            clearInterval(this.assessmentTimer);
            this.assessmentTimer = null;
            console.log('[EA:StopAssessmentTimer] Assessment timer stopped');
        }
    }
    
    loadQuestion(questionIndex) {
        if (questionIndex >= this.questionSequence.length) {
            this.completeAssessment();
            return;
        }
        
        this.currentQuestion = questionIndex;
        const question = this.questionSequence[questionIndex];
        
        console.log('[EA:LoadQuestion] Loading question', questionIndex + 1, 'of', this.questionSequence.length);
        
        this.renderQuestion(question);
        this.renderProgressIndicators();
    }
    
    renderQuestion(question) {
        console.log('[EA] Rendering question:', question.id, 'Type:', question.type);
        const questionContainer = document.getElementById('question-container');
        const questionText = document.getElementById('question-text');
        const optionsContainer = document.getElementById('options-container');
        const navigationContainer = document.getElementById('navigation-container');
        
        if (!questionContainer || !optionsContainer) {
            console.error('[EA] Required DOM elements not found');
            return;
        }
        
        // Hide traditional question text for interactive questions
        if (questionText) {
            questionText.style.display = question.type === 'traditional' ? 'block' : 'none';
        }
        
        // Clear previous content
        optionsContainer.innerHTML = '';
        optionsContainer.className = 'options-container';
        
        // Render based on question type
        switch(question.type) {
            case 'likert_grid':
                this.interactiveComponents.renderLikertGrid(question, optionsContainer);
                break;
            case 'sliding_spectrum':
                this.interactiveComponents.renderSlidingSpectrum(question, optionsContainer);
                break;
            case 'priority_matrix':
                this.interactiveComponents.renderPriorityMatrix(question, optionsContainer);
                break;
            case 'speed_ranking':
                this.interactiveComponents.renderSpeedRanking(question, optionsContainer);
                break;
            case 'word_cloud':
                this.interactiveComponents.renderWordCloud(question, optionsContainer);
                break;
            case 'emoji_reaction':
                this.interactiveComponents.renderEmojiReaction(question, optionsContainer);
                break;
            case 'percentage_allocator':
                this.interactiveComponents.renderPercentageAllocator(question, optionsContainer);
                break;
            case 'two_pile_sort':
                this.interactiveComponents.renderTwoPileSort(question, optionsContainer);
                break;
            default:
                // Traditional question types
                if (questionText) {
                    questionText.style.display = 'block';
                    questionText.textContent = question.question;
                }
                this.renderTraditionalQuestion(question, optionsContainer);
        }
        
        // Update navigation
        this.renderNavigation(navigationContainer);
        
        // Add animation
        optionsContainer.style.animation = 'fadeIn 0.4s ease-out';
    }
    
    renderTraditionalQuestion(question, container) {
        const optionsHTML = question.options.map((option, index) => `
            <label class="assessment-option">
                <input type="radio" 
                       name="question_${question.id}" 
                       value="${index}"
                       data-indicators='${JSON.stringify(option.behavioral_indicators)}'
                       data-weights='${JSON.stringify(option.score_weights)}'>
                <span class="option-text">${option.text}</span>
            </label>
        `).join('');
        
        container.innerHTML = optionsHTML;
        
        // Add change listeners
        const inputs = container.querySelectorAll('input[type="radio"]');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.recordResponse());
        });
    }
    
    renderNavigation(container) {
        if (!container) {
            console.error('[EA:RenderNavigation] No container provided');
            return;
        }
        
        const isFirstQuestion = this.currentQuestion === 0;
        const isLastQuestion = this.currentQuestion === this.questionSequence.length - 1;
        
        const navigationHTML = `
            <div class="navigation-buttons">
                <button class="nav-btn" id="prev-btn" ${isFirstQuestion ? 'disabled' : ''}>
                    Previous Question
                </button>
                <span class="question-counter">
                    Question ${this.currentQuestion + 1} of ${this.questionSequence.length}
                </span>
                <button class="nav-btn" id="next-btn" ${isLastQuestion ? 'disabled' : ''}>
                    ${isLastQuestion ? 'Complete Assessment' : 'Next Question'}
                </button>
            </div>
        `;
        
        container.innerHTML = navigationHTML;
        
        // Add event listeners
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousQuestion());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextQuestion());
        }
        
        console.log('[EA:RenderNavigation] Navigation rendered successfully');
    }
    
    renderProgressIndicators() {
        const container = document.querySelector('.progress-indicators');
        if (!container) return;
        
        const dotsHTML = this.questionSequence.map((_, index) => {
            let className = 'progress-dot';
            if (index === this.currentQuestion) {
                className += ' active';
            } else if (index < this.currentQuestion) {
                className += ' completed';
            }
            return `<div class="${className}" data-question="${index}"></div>`;
        }).join('');
        
        container.innerHTML = dotsHTML;
        
        // Add click listeners for navigation
        container.querySelectorAll('.progress-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const questionIndex = parseInt(dot.dataset.question);
                if (questionIndex < this.currentQuestion) {
                    this.loadQuestion(questionIndex);
                }
            });
        });
    }
    
    recordResponse() {
        const currentQuestion = this.questionSequence[this.currentQuestion];
        
        // Get response from interactive component
        const interactiveResponse = this.interactiveComponents.getResponse(currentQuestion.id);
        
        if (interactiveResponse) {
            this.assessmentState.responses.push({
                questionId: currentQuestion.id,
                questionType: currentQuestion.type,
                response: interactiveResponse,
                timestamp: new Date().toISOString()
            });
        } else {
            // Handle traditional questions
            const selectedOption = document.querySelector(`input[name="question_${currentQuestion.id}"]:checked`);
            if (selectedOption) {
                this.assessmentState.responses.push({
                    questionId: currentQuestion.id,
                    questionType: currentQuestion.type,
                    selectedIndex: selectedOption.value,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
    
    validateCurrentQuestion() {
        const currentQuestion = this.questionSequence[this.currentQuestion];
        if (!currentQuestion) {
            console.warn('[EA] No current question found');
            return false;
        }
        
        console.log('[EA] Validating question:', currentQuestion.id, 'Type:', currentQuestion.type);
        
        // Check if this is an interactive question type
        const interactiveTypes = ['likert_grid', 'sliding_spectrum', 'priority_matrix', 'speed_ranking', 'word_cloud', 'emoji_reaction', 'percentage_allocator', 'two_pile_sort'];
        
        if (interactiveTypes.includes(currentQuestion.type)) {
            // Interactive question validation
            if (this.interactiveComponents && this.interactiveComponents.isQuestionComplete) {
                const isComplete = this.interactiveComponents.isQuestionComplete(
                    currentQuestion.id, 
                    currentQuestion.type
                );
                
                if (!isComplete) {
                    console.log('[EA] Interactive question not complete');
                    this.showValidationError(currentQuestion.type);
                    return false;
                }
                console.log('[EA] Interactive question validation passed');
                return true;
            } else {
                console.warn('[EA] Interactive components not available');
                return false;
            }
        } else {
            // Traditional question validation
            const selectedOption = document.querySelector(`input[name="question_${currentQuestion.id}"]:checked`);
            const isValid = selectedOption !== null;
            console.log('[EA] Traditional question validation:', isValid);
            return isValid;
        }
    }

    // Add validation error display
    showValidationError(questionType) {
        const messages = {
            'likert_grid': 'Please rate all statements',
            'sliding_spectrum': 'Please position yourself on all spectrums',
            'priority_matrix': 'Please place all items in the matrix',
            'speed_ranking': 'Please rank all items',
            'word_cloud': 'Please select exactly 5 words',
            'emoji_reaction': 'Please select your reaction',
            'percentage_allocator': 'Please allocate exactly 100 points',
            'two_pile_sort': 'Please sort all items into piles'
        };
        
        const message = messages[questionType] || 'Please complete the question';
        
        // Create or update error message
        let errorDiv = document.getElementById('validation-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'validation-error';
            errorDiv.className = 'validation-error';
            document.getElementById('options-container').appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
    
    nextQuestion() {
        if (!this.validateCurrentQuestion()) {
            console.warn('[EA:NextQuestion] Validation failed, cannot proceed');
            return;
        }
        
        // Record the response before moving to next question
        this.recordResponse();
        
        const nextIndex = this.currentQuestion + 1;
        if (nextIndex < this.questionSequence.length) {
            this.loadQuestion(nextIndex);
        } else {
            console.log('[EA] All questions completed, finishing assessment...');
            this.completeAssessment();
        }
    }
    
    previousQuestion() {
        const prevIndex = this.currentQuestion - 1;
        if (prevIndex >= 0) {
            this.loadQuestion(prevIndex);
        }
    }
    
    async completeAssessment() {
        console.log('[EA] Completing assessment...');
        
        this.assessmentState.status = 'completed';
        this.assessmentState.endTime = Date.now();
        
        // Stop assessment timer
        this.stopAssessmentTimer();
        
        // Generate analysis
        const analysis = await this.generateFinalAnalysis();
        
        // Show completion screen
        this.showCompletionScreen(analysis);
        
        console.log('[EA] Assessment completed');
    }
    
    async generateFinalAnalysis() {
        console.log('[EA] Generating behavioral analysis...');
        
        const dimensionalScores = this.calculateDimensionalScores();
        const behavioralProfile = this.generateBehavioralProfile();
        const consistencyAnalysis = this.checkResponseConsistency();
        const frameworkMappings = this.generateFrameworkMappings(dimensionalScores);
        
        const analysis = {
            dimensionalScores,
            behavioralProfile,
            consistencyScore: consistencyAnalysis.score,
            completionTime: this.assessmentState.endTime - this.assessmentState.startTime,
            strengthAreas: this.identifyStrengths(dimensionalScores),
            developmentAreas: this.identifyDevelopmentAreas(dimensionalScores),
            fitScore: this.calculateCulturalFit(behavioralProfile),
            recommendations: this.generateRecommendations(dimensionalScores, behavioralProfile),
            frameworks: frameworkMappings
        };
        
        console.log('[EA] Analysis complete with framework mappings');
        return analysis;
    }
    
    calculateDimensionalScores() {
        // Initialize dimensions from centralized configuration
        const dimensions = {};
        Object.keys(this.ASSESSMENT_DIMENSIONS).forEach(dim => {
            dimensions[dim] = { total: 0, count: 0, weighted: 0, weight: this.ASSESSMENT_DIMENSIONS[dim].weight };
        });
        
        console.log('[EA] Calculating dimensional scores for', this.assessmentState.responses.length, 'responses');
        
        this.assessmentState.responses.forEach(response => {
            const question = this.questionBank.find(q => q.id === response.questionId);
            if (!question) {
                console.warn('[EA] Question not found for response:', response.questionId);
                return;
            }
            
            if (response.questionType === 'traditional' && response.selectedIndex !== undefined) {
                // Handle traditional questions
                const selectedOption = question.options[response.selectedIndex];
                if (selectedOption && selectedOption.score_weights) {
                    Object.keys(selectedOption.score_weights).forEach(dim => {
                        if (dimensions[dim]) {
                            dimensions[dim].total += selectedOption.score_weights[dim];
                            dimensions[dim].count++;
                        }
                    });
                }
            } else if (response.questionType && response.response) {
                // Handle interactive questions
                this.processInteractiveResponse(response, question, dimensions);
            }
        });
        
        // Calculate percentages and weighted scores
        Object.keys(dimensions).forEach(dim => {
            dimensions[dim].percentage = dimensions[dim].count > 0 
                ? Math.round((dimensions[dim].total / dimensions[dim].count) * 100)
                : 0;
            
            // Calculate weighted score based on dimension importance
            dimensions[dim].weighted = dimensions[dim].percentage * dimensions[dim].weight;
        });
        
        console.log('[EA] Dimensional scores calculated:', dimensions);
        return dimensions;
    }

    // Generate personality framework mappings
    generateFrameworkMappings(dimensionalScores) {
        const frameworks = {
            mbti: this.mapToMBTI(dimensionalScores),
            big5: this.mapToBig5(dimensionalScores),
            disc: this.mapToDISC(dimensionalScores),
            enneagram: this.mapToEnneagram(dimensionalScores)
        };
        
        return frameworks;
    }

    mapToMBTI(dimensions) {
        // MBTI mapping based on dimensional scores
        const extroversion = (dimensions.social_calibration?.percentage || 0) + 
                           (dimensions.relationship_building?.percentage || 0) + 
                           (dimensions.collaborative_intelligence?.percentage || 0);
        const introversion = 300 - extroversion;
        
        const sensing = (dimensions.systems_thinking?.percentage || 0) + 
                       (dimensions.self_management?.percentage || 0);
        const intuition = 200 - sensing;
        
        const thinking = (dimensions.systems_thinking?.percentage || 0) + 
                        (dimensions.ethical_reasoning?.percentage || 0);
        const feeling = 200 - thinking;
        
        const judging = (dimensions.self_management?.percentage || 0) + 
                       (dimensions.achievement_drive?.percentage || 0);
        const perceiving = 200 - judging;
        
        return {
            type: `${extroversion > introversion ? 'E' : 'I'}${sensing > intuition ? 'S' : 'N'}${thinking > feeling ? 'T' : 'F'}${judging > perceiving ? 'J' : 'P'}`,
            scores: { extroversion, introversion, sensing, intuition, thinking, feeling, judging, perceiving }
        };
    }

    mapToBig5(dimensions) {
        // Big5 mapping
        return {
            openness: Math.round((dimensions.cognitive_flexibility?.percentage || 0) * 0.4 + 
                                (dimensions.learning_orientation?.percentage || 0) * 0.6),
            conscientiousness: Math.round((dimensions.self_management?.percentage || 0) * 0.5 + 
                                         (dimensions.ethical_reasoning?.percentage || 0) * 0.5),
            extraversion: Math.round((dimensions.social_calibration?.percentage || 0) * 0.4 + 
                                    (dimensions.relationship_building?.percentage || 0) * 0.6),
            agreeableness: Math.round((dimensions.collaborative_intelligence?.percentage || 0) * 0.5 + 
                                     (dimensions.relationship_building?.percentage || 0) * 0.5),
            neuroticism: Math.round(100 - (dimensions.emotional_regulation?.percentage || 0))
        };
    }

    mapToDISC(dimensions) {
        // DISC mapping
        return {
            dominance: Math.round((dimensions.influence_style?.percentage || 0) * 0.6 + 
                                 (dimensions.achievement_drive?.percentage || 0) * 0.4),
            influence: Math.round((dimensions.relationship_building?.percentage || 0) * 0.5 + 
                                 (dimensions.social_calibration?.percentage || 0) * 0.5),
            steadiness: Math.round((dimensions.emotional_regulation?.percentage || 0) * 0.5 + 
                                  (dimensions.self_management?.percentage || 0) * 0.5),
            compliance: Math.round((dimensions.ethical_reasoning?.percentage || 0) * 0.6 + 
                                  (dimensions.systems_thinking?.percentage || 0) * 0.4)
        };
    }

    mapToEnneagram(dimensions) {
        // Enneagram mapping (simplified)
        const scores = [
            { type: 1, score: dimensions.ethical_reasoning?.percentage || 0 },
            { type: 2, score: dimensions.relationship_building?.percentage || 0 },
            { type: 3, score: dimensions.achievement_drive?.percentage || 0 },
            { type: 4, score: dimensions.emotional_regulation?.percentage || 0 },
            { type: 5, score: dimensions.systems_thinking?.percentage || 0 },
            { type: 6, score: dimensions.risk_tolerance?.percentage || 0 },
            { type: 7, score: dimensions.cognitive_flexibility?.percentage || 0 },
            { type: 8, score: dimensions.influence_style?.percentage || 0 },
            { type: 9, score: dimensions.collaborative_intelligence?.percentage || 0 }
        ];
        
        const primaryType = scores.reduce((max, current) => 
            current.score > max.score ? current : max
        );
        
        return {
            primary: primaryType.type,
            scores: scores
        };
    }

    processInteractiveResponse(response, question, dimensions) {
        switch (response.questionType) {
            case 'likert_grid':
                // Process Likert grid responses
                Object.keys(response.response).forEach(statementId => {
                    const statement = question.statements[statementId];
                    if (statement && statement.dimensions) {
                        Object.keys(statement.dimensions).forEach(dim => {
                            if (dimensions[dim]) {
                                const value = response.response[statementId].value;
                                const weight = statement.dimensions[dim];
                                dimensions[dim].total += (value / 5) * weight; // Normalize 1-5 to 0-1
                                dimensions[dim].count++;
                            }
                        });
                    }
                });
                break;
                
            case 'sliding_spectrum':
                // Process spectrum responses
                Object.keys(response.response).forEach(spectrumId => {
                    const spectrum = question.spectrums[spectrumId];
                    if (spectrum && spectrum.dimension && dimensions[spectrum.dimension]) {
                        const value = response.response[spectrumId].value;
                        dimensions[spectrum.dimension].total += value / 100; // Normalize 0-100 to 0-1
                        dimensions[spectrum.dimension].count++;
                    }
                });
                break;
                
            case 'word_cloud':
                // Process word cloud selections
                response.response.forEach(selectedWord => {
                    if (selectedWord.dimensions) {
                        Object.keys(selectedWord.dimensions).forEach(dim => {
                            if (dimensions[dim]) {
                                dimensions[dim].total += selectedWord.dimensions[dim];
                                dimensions[dim].count++;
                            }
                        });
                    }
                });
                break;
                
            case 'emoji_reaction':
                // Process emoji reaction
                if (response.response.dimensions) {
                    Object.keys(response.response.dimensions).forEach(dim => {
                        if (dimensions[dim]) {
                            dimensions[dim].total += response.response.dimensions[dim];
                            dimensions[dim].count++;
                        }
                    });
                }
                break;
                
            case 'percentage_allocator':
                // Process percentage allocations
                response.response.forEach(allocation => {
                    if (allocation.dimensions) {
                        Object.keys(allocation.dimensions).forEach(dim => {
                            if (dimensions[dim]) {
                                dimensions[dim].total += (allocation.value / 100) * allocation.dimensions[dim];
                                dimensions[dim].count++;
                            }
                        });
                    }
                });
                break;
                
            case 'speed_ranking':
                // Process speed ranking - higher ranks get higher scores
                response.response.forEach((rankedItem, index) => {
                    const question = this.questionBank.find(q => q.id === response.questionId);
                    if (question && question.items && question.items[rankedItem.itemId]) {
                        const item = question.items[rankedItem.itemId];
                        if (item.dimensions) {
                            Object.keys(item.dimensions).forEach(dim => {
                                if (dimensions[dim]) {
                                    // Higher rank (lower number) gets higher score
                                    const rankScore = (6 - rankedItem.rank) / 5; // Normalize 1-5 to 0-1
                                    dimensions[dim].total += item.dimensions[dim] * rankScore;
                                    dimensions[dim].count++;
                                }
                            });
                        }
                    }
                });
                break;
                
            case 'priority_matrix':
                // Process priority matrix - quadrant placement affects scores
                Object.keys(response.response).forEach(itemId => {
                    const question = this.questionBank.find(q => q.id === response.questionId);
                    if (question && question.items && question.items[itemId]) {
                        const item = question.items[itemId];
                        const quadrant = response.response[itemId].quadrant;
                        
                        // Quadrant scoring: Q1 (urgent-important) gets highest score
                        let quadrantMultiplier = 0.6; // Default for Q4
                        if (quadrant === 'urgent-important') quadrantMultiplier = 1.0;
                        else if (quadrant === 'not-urgent-important') quadrantMultiplier = 0.8;
                        else if (quadrant === 'urgent-not-important') quadrantMultiplier = 0.7;
                        
                        if (item.dimensions) {
                            Object.keys(item.dimensions).forEach(dim => {
                                if (dimensions[dim]) {
                                    dimensions[dim].total += item.dimensions[dim] * quadrantMultiplier;
                                    dimensions[dim].count++;
                                }
                            });
                        }
                    }
                });
                break;
                
            case 'two_pile_sort':
                // Process two-pile sort - pile A gets positive scores, pile B gets negative
                const pileA = response.response.pileA || [];
                const pileB = response.response.pileB || [];
                
                // Process pile A (positive scores)
                pileA.forEach(item => {
                    const question = this.questionBank.find(q => q.id === response.questionId);
                    if (question && question.items && question.items[item.id]) {
                        const itemData = question.items[item.id];
                        if (itemData.dimensions) {
                            Object.keys(itemData.dimensions).forEach(dim => {
                                if (dimensions[dim]) {
                                    dimensions[dim].total += itemData.dimensions[dim];
                                    dimensions[dim].count++;
                                }
                            });
                        }
                    }
                });
                
                // Process pile B (negative scores - indicates avoidance)
                pileB.forEach(item => {
                    const question = this.questionBank.find(q => q.id === response.questionId);
                    if (question && question.items && question.items[item.id]) {
                        const itemData = question.items[item.id];
                        if (itemData.dimensions) {
                            Object.keys(itemData.dimensions).forEach(dim => {
                                if (dimensions[dim]) {
                                    // Negative score indicates avoidance of this dimension
                                    dimensions[dim].total -= itemData.dimensions[dim] * 0.5;
                                    dimensions[dim].count++;
                                }
                            });
                        }
                    }
                });
                break;
        }
    }
    
    generateBehavioralProfile() {
        const profile = {
            responsePatterns: this.analyzeResponsePatterns(),
            decisionSpeed: this.analyzeDecisionSpeed(),
            consistencyMarkers: this.analyzeConsistencyMarkers()
        };
        
        return profile;
    }

    analyzeResponsePatterns() {
        // Simple response pattern analysis
        const patterns = {
            totalQuestions: this.assessmentState.responses.length,
            interactiveQuestions: this.assessmentState.responses.filter(r => r.questionType !== 'traditional').length,
            traditionalQuestions: this.assessmentState.responses.filter(r => r.questionType === 'traditional').length,
            averageResponseTime: this.calculateAverageResponseTime()
        };
        
        return patterns;
    }

    calculateAverageResponseTime() {
        if (this.assessmentState.responses.length < 2) return 0;
        
        let totalTime = 0;
        for (let i = 1; i < this.assessmentState.responses.length; i++) {
            const currentTime = new Date(this.assessmentState.responses[i].timestamp).getTime();
            const previousTime = new Date(this.assessmentState.responses[i-1].timestamp).getTime();
            totalTime += currentTime - previousTime;
        }
        
        return Math.round(totalTime / (this.assessmentState.responses.length - 1));
    }
    
    analyzeDecisionSpeed() {
        const responseTimes = this.assessmentState.responses.map(r => r.timestamp);
        if (responseTimes.length < 2) return 'Insufficient data';
        
        const avgTime = responseTimes.reduce((sum, time, i) => {
            if (i === 0) return 0;
            return sum + (time - responseTimes[i - 1]);
        }, 0) / (responseTimes.length - 1);
        
        if (avgTime < 5000) return 'Fast';
        if (avgTime < 15000) return 'Moderate';
        return 'Deliberate';
    }
    
    analyzeConsistencyMarkers() {
        const markers = [];
        const responses = this.assessmentState.responses;
        
        // Check for pattern consistency
        const uniqueSelections = new Set(responses.map(r => r.selectedIndex)).size;
        if (uniqueSelections < responses.length * 0.3) {
            markers.push('Low response variety');
        }
        
        // Check for behavioral consistency
        const behavioralPatterns = responses.map(r => r.behavioralIndicators).flat();
        const patternCounts = {};
        behavioralPatterns.forEach(pattern => {
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        });
        
        Object.entries(patternCounts).forEach(([pattern, count]) => {
            if (count > responses.length * 0.4) {
                markers.push(`Strong ${pattern} tendency`);
            }
        });
        
        return markers;
    }
    
    checkResponseConsistency() {
        const consistency = this.behavioralAnalyzer.analyzeConsistency();
        return {
            score: consistency.consistencyScore,
            engagement: consistency.engagementLevel,
            averageTime: consistency.averageResponseTime
        };
    }
    
    identifyStrengths(scores) {
        const strengths = [];
        Object.entries(scores).forEach(([dimension, data]) => {
            if (data.percentage >= 80) {
                strengths.push({
                    dimension,
                    score: data.percentage,
                    description: this.getDimensionDescription(dimension)
                });
            }
        });
        return strengths.sort((a, b) => b.score - a.score);
    }
    
    identifyDevelopmentAreas(scores) {
        const areas = [];
        Object.entries(scores).forEach(([dimension, data]) => {
            if (data.percentage <= 60) {
                areas.push({
                    dimension,
                    score: data.percentage,
                    description: this.getDimensionDescription(dimension)
                });
            }
        });
        return areas.sort((a, b) => a.score - b.score);
    }
    
    getDimensionDescription(dimension) {
        const descriptions = {
            client_advocacy: 'Client-focused relationship building',
            ethical_flexibility: 'Ethical decision-making under pressure',
            emotional_durability: 'Resilience and stress management',
            strategic_thinking: 'Long-term planning and systems thinking',
            social_intelligence: 'Interpersonal effectiveness'
        };
        return descriptions[dimension] || dimension;
    }
    
    calculateCulturalFit(profile) {
        // Simple cultural fit calculation based on Northwestern Mutual values
        let fitScore = 70; // Base score
        
        if (profile.responsePatterns.engagementLevel === 'High') fitScore += 10;
        if (profile.responsePatterns.consistencyScore > 80) fitScore += 10;
        if (profile.decisionSpeed === 'Moderate' || profile.decisionSpeed === 'Deliberate') fitScore += 10;
        
        return Math.min(100, fitScore);
    }
    
    generateRecommendations(scores, profile) {
        const recommendations = [];
        
        // Add dimension-specific recommendations
        Object.entries(scores).forEach(([dimension, data]) => {
            if (data.percentage <= 60) {
                recommendations.push({
                    type: 'development',
                    dimension,
                    action: this.getDevelopmentAction(dimension)
                });
            } else if (data.percentage >= 80) {
                recommendations.push({
                    type: 'leverage',
                    dimension,
                    action: this.getLeverageAction(dimension)
                });
            }
        });
        
        // Add behavioral recommendations
        if (profile.responsePatterns.engagementLevel === 'Low') {
            recommendations.push({
                type: 'behavioral',
                action: 'Consider additional engagement strategies during client interactions'
            });
        }
        
        return recommendations;
    }
    
    getDevelopmentAction(dimension) {
        const actions = {
            client_advocacy: 'Focus on active listening and client needs discovery',
            ethical_flexibility: 'Practice ethical decision-making frameworks',
            emotional_durability: 'Develop stress management and resilience techniques',
            strategic_thinking: 'Enhance long-term planning and systems analysis',
            social_intelligence: 'Improve interpersonal communication and relationship building'
        };
        return actions[dimension] || 'Focus on general professional development';
    }
    
    getLeverageAction(dimension) {
        const actions = {
            client_advocacy: 'Leverage strong client relationships for referrals',
            ethical_flexibility: 'Use ethical decision-making as a competitive advantage',
            emotional_durability: 'Take on high-pressure situations and leadership roles',
            strategic_thinking: 'Lead strategic initiatives and long-term planning',
            social_intelligence: 'Build strong networks and mentor others'
        };
        return actions[dimension] || 'Continue developing this strength area';
    }
    
    showCompletionScreen(analysis) {
        const questionContainer = document.getElementById('question-container');
        const completionScreen = document.getElementById('completion-screen');
        
        if (questionContainer) questionContainer.style.display = 'none';
        if (completionScreen) {
            completionScreen.style.display = 'block';
            this.renderResults(completionScreen, analysis);
        }
    }
    
    renderResults(container, analysis) {
        const resultsHTML = `
            <div class="results-header">
                <h2>Assessment Complete</h2>
                <p>Thank you for completing the Elite Behavioral Assessment. Your results are being analyzed.</p>
            </div>
            
            <div class="results-summary">
                <h3>Dimensional Scores</h3>
                <div class="score-breakdown">
                    ${Object.entries(analysis.dimensionalScores).map(([dim, data]) => `
                        <div class="score-item">
                            <span class="dimension-name">${this.formatDimensionName(dim)}</span>
                            <span class="dimension-score">${data.percentage}%</span>
                        </div>
                    `).join('')}
                </div>
                
                <h3>Key Insights</h3>
                <div class="insights">
                    ${analysis.strengthAreas.length > 0 ? `
                        <div class="strengths">
                            <h4>Strengths</h4>
                            <ul>
                                ${analysis.strengthAreas.map(s => `
                                    <li>${s.description} (${s.score}%)</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${analysis.developmentAreas.length > 0 ? `
                        <div class="development-areas">
                            <h4>Development Areas</h4>
                            <ul>
                                ${analysis.developmentAreas.map(d => `
                                    <li>${d.description} (${d.score}%)</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                
                <h3>Recommendations</h3>
                <div class="recommendations">
                    <ul>
                        ${analysis.recommendations.map(r => `
                            <li>${r.action}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        container.innerHTML = resultsHTML;
    }
    
    formatDimensionName(dimension) {
        return dimension.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.assessmentEngine = new EliteAssessmentEngine();
});

