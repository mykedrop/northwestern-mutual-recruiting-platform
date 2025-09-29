// Interactive Question Components for Elite Behavioral Assessment
class InteractiveQuestionComponents {
  constructor() {
    this.responses = {};
    this.timers = {};
  }

  // 1. LIKERT GRID - Rate multiple statements at once
  renderLikertGrid(question, container) {
    const gridHTML = `
      <div class="likert-grid">
        <h3 class="question-prompt">${question.prompt}</h3>
        <div class="likert-header">
          <span class="statement-column"></span>
          <span>Never</span>
          <span>Rarely</span>
          <span>Sometimes</span>
          <span>Often</span>
          <span>Always</span>
        </div>
        ${question.statements.map((statement, idx) => `
          <div class="likert-row" data-statement-id="${idx}">
            <span class="statement-text">${statement.text}</span>
            ${[1,2,3,4,5].map(value => `
              <label class="likert-option">
                <input type="radio" 
                       name="likert_${question.id}_${idx}" 
                       value="${value}"
                       data-statement="${idx}"
                       required>
                <span class="likert-radio"></span>
              </label>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
    
    container.innerHTML = gridHTML;
    
    // Track responses
    container.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const statementId = e.target.dataset.statement;
        if (!this.responses[question.id]) {
          this.responses[question.id] = {};
        }
        this.responses[question.id][statementId] = {
          value: parseInt(e.target.value),
          dimensions: question.statements[statementId].dimensions
        };
      });
    });
  }

  // 2. SLIDING SPECTRUM - Visual sliders between opposing traits
  renderSlidingSpectrum(question, container) {
    const spectrumHTML = `
      <div class="sliding-spectrum">
        <h3 class="question-prompt">${question.prompt}</h3>
        ${question.spectrums.map((spectrum, idx) => `
          <div class="spectrum-item" data-spectrum-id="${idx}">
            <div class="spectrum-labels">
              <span class="left-label">${spectrum.left}</span>
              <span class="right-label">${spectrum.right}</span>
            </div>
            <input type="range" 
                   class="spectrum-slider" 
                   id="spectrum_${question.id}_${idx}"
                   min="0" max="100" value="50"
                   data-dimension="${spectrum.dimension}"
                   data-spectrum-id="${idx}">
            <div class="spectrum-value">50</div>
          </div>
        `).join('')}
      </div>
    `;
    
    container.innerHTML = spectrumHTML;
    
    // Add slider listeners
    container.querySelectorAll('.spectrum-slider').forEach(slider => {
      const valueDisplay = slider.nextElementSibling;
      slider.addEventListener('input', (e) => {
        valueDisplay.textContent = e.target.value;
        const spectrumId = e.target.dataset.spectrumId;
        if (!this.responses[question.id]) {
          this.responses[question.id] = {};
        }
        this.responses[question.id][spectrumId] = {
          value: parseInt(e.target.value),
          dimension: e.target.dataset.dimension
        };
      });
    });
  }

  // 3. DRAG AND DROP PRIORITY MATRIX
  renderPriorityMatrix(question, container) {
    const matrixHTML = `
      <div class="priority-matrix">
        <h3 class="question-prompt">${question.prompt}</h3>
        <div class="matrix-container">
          <div class="matrix-labels">
            <span class="y-axis-label">↑ Urgent</span>
            <span class="x-axis-label">Important →</span>
          </div>
          <div class="matrix-grid">
            <div class="quadrant q1" data-quadrant="urgent-important">
              <h4>Do First</h4>
              <div class="drop-zone" data-quadrant="1"></div>
            </div>
            <div class="quadrant q2" data-quadrant="not-urgent-important">
              <h4>Schedule</h4>
              <div class="drop-zone" data-quadrant="2"></div>
            </div>
            <div class="quadrant q3" data-quadrant="urgent-not-important">
              <h4>Delegate</h4>
              <div class="drop-zone" data-quadrant="3"></div>
            </div>
            <div class="quadrant q4" data-quadrant="not-urgent-not-important">
              <h4>Eliminate</h4>
              <div class="drop-zone" data-quadrant="4"></div>
            </div>
          </div>
        </div>
        <div class="draggable-items">
          <h4>Drag items to quadrants:</h4>
          ${question.items.map((item, idx) => `
            <div class="draggable-item" 
                 draggable="true" 
                 data-item-id="${idx}"
                 data-item-text="${item.text}">
              ${item.text}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = matrixHTML;
    this.initializeDragDrop(question.id);
  }

  initializeDragDrop(questionId) {
    const items = document.querySelectorAll('.draggable-item');
    const dropZones = document.querySelectorAll('.drop-zone');
    let draggedItem = null;

    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        e.target.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
      });
    });

    dropZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (draggedItem) {
          zone.appendChild(draggedItem);
          
          // Track response
          if (!this.responses[questionId]) {
            this.responses[questionId] = {};
          }
          this.responses[questionId][draggedItem.dataset.itemId] = {
            quadrant: zone.dataset.quadrant,
            text: draggedItem.dataset.itemText
          };
          draggedItem = null;
        }
      });
    });
  }

  // 4. SPEED RANKING - 10 second timer
  renderSpeedRanking(question, container) {
    const speedHTML = `
      <div class="speed-ranking">
        <div class="timer-display">
          <div class="timer-circle">
            <svg width="80" height="80">
              <circle cx="40" cy="40" r="36" stroke="#e5e7eb" stroke-width="4" fill="none"/>
              <circle class="timer-progress" cx="40" cy="40" r="36" stroke="#4a90e2" stroke-width="4" fill="none"
                      stroke-dasharray="226" stroke-dashoffset="0" transform="rotate(-90 40 40)"/>
            </svg>
            <span class="timer-text">10</span>
          </div>
        </div>
        <h3 class="question-prompt">${question.prompt}</h3>
        <div class="ranking-items">
          ${question.items.map((item, idx) => `
            <div class="rank-item" 
                 data-item-id="${idx}"
                 data-item-text="${item.text}">
              <span class="rank-number"></span>
              <span class="item-text">${item.text}</span>
            </div>
          `).join('')}
        </div>
        <button class="skip-timer-btn">Skip Timer</button>
      </div>
    `;
    
    container.innerHTML = speedHTML;
    this.startSpeedTimer(question.id, 10);
    this.initializeRanking(question.id);
  }

  startSpeedTimer(questionId, seconds) {
    let timeLeft = seconds;
    const timerText = document.querySelector('.timer-text');
    const timerProgress = document.querySelector('.timer-progress');
    const totalDash = 226;
    
    this.timers[questionId] = setInterval(() => {
      timeLeft--;
      timerText.textContent = timeLeft;
      const offset = totalDash - (totalDash * timeLeft / seconds);
      timerProgress.style.strokeDashoffset = offset;
      
      if (timeLeft <= 0) {
        clearInterval(this.timers[questionId]);
        this.autoSubmitRanking(questionId);
      }
    }, 1000);

    // Skip timer button
    document.querySelector('.skip-timer-btn').addEventListener('click', () => {
      clearInterval(this.timers[questionId]);
      this.autoSubmitRanking(questionId);
    });
  }

  initializeRanking(questionId) {
    const items = document.querySelectorAll('.rank-item');
    let currentRank = 1;
    
    items.forEach(item => {
      item.addEventListener('click', () => {
        if (!item.classList.contains('ranked')) {
          item.classList.add('ranked');
          item.querySelector('.rank-number').textContent = currentRank;
          
          if (!this.responses[questionId]) {
            this.responses[questionId] = [];
          }
          this.responses[questionId].push({
            rank: currentRank,
            itemId: item.dataset.itemId,
            text: item.dataset.itemText
          });
          currentRank++;
        }
      });
    });
  }

  autoSubmitRanking(questionId) {
    // Auto-rank remaining items
    const unranked = document.querySelectorAll('.rank-item:not(.ranked)');
    let currentRank = document.querySelectorAll('.rank-item.ranked').length + 1;
    
    unranked.forEach(item => {
      item.classList.add('ranked');
      item.querySelector('.rank-number').textContent = currentRank;
      if (!this.responses[questionId]) {
        this.responses[questionId] = [];
      }
      this.responses[questionId].push({
        rank: currentRank,
        itemId: item.dataset.itemId,
        text: item.dataset.itemText
      });
      currentRank++;
    });
  }

  // 5. WORD CLOUD SELECTION
  renderWordCloud(question, container) {
    const words = this.shuffleArray([...question.words]);
    const cloudHTML = `
      <div class="word-cloud-selector">
        <h3 class="question-prompt">${question.prompt}</h3>
        <p class="selection-counter">
          Selected: <span class="selected-count">0</span> / ${question.selectCount}
        </p>
        <div class="word-cloud">
          ${words.map((word, idx) => {
            const size = 0.8 + Math.random() * 0.7;
            const rotate = Math.random() * 10 - 5;
            return `
              <span class="word-bubble" 
                    data-word-id="${idx}"
                    data-word="${word.text}"
                    data-dimensions='${JSON.stringify(word.dimensions)}'
                    style="font-size: ${size}em; transform: rotate(${rotate}deg)">
                ${word.text}
              </span>
            `;
          }).join('')}
        </div>
        <div class="selected-words">
          <h4>Your selections:</h4>
          <div class="selected-list"></div>
        </div>
      </div>
    `;
    
    container.innerHTML = cloudHTML;
    this.initializeWordCloud(question.id, question.selectCount);
  }

  initializeWordCloud(questionId, maxSelect) {
    const words = document.querySelectorAll('.word-bubble');
    const selectedList = document.querySelector('.selected-list');
    const selectedCount = document.querySelector('.selected-count');
    let selected = [];
    
    words.forEach(word => {
      word.addEventListener('click', () => {
        if (word.classList.contains('selected')) {
          // Deselect
          word.classList.remove('selected');
          selected = selected.filter(w => w.id !== word.dataset.wordId);
        } else if (selected.length < maxSelect) {
          // Select
          word.classList.add('selected');
          selected.push({
            id: word.dataset.wordId,
            text: word.dataset.word,
            dimensions: JSON.parse(word.dataset.dimensions)
          });
        }
        
        selectedCount.textContent = selected.length;
        selectedList.innerHTML = selected.map(w => 
          `<span class="selected-word">${w.text}</span>`
        ).join('');
        
        this.responses[questionId] = selected;
      });
    });
  }

  // 6. EMOJI REACTION
  renderEmojiReaction(question, container) {
    const emojiHTML = `
      <div class="emoji-reaction">
        <div class="scenario-box">
          <h3>Scenario:</h3>
          <p class="scenario-text">${question.scenario}</p>
        </div>
        <p class="reaction-prompt">Your immediate reaction:</p>
        <div class="emoji-options">
          ${question.reactions.map((reaction, idx) => `
            <button class="emoji-btn" 
                    data-reaction-id="${idx}"
                    data-reaction-type="${reaction.type}"
                    data-dimensions='${JSON.stringify(reaction.dimensions)}'>
              <span class="emoji">${reaction.emoji}</span>
              <span class="emoji-label">${reaction.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = emojiHTML;
    
    const buttons = container.querySelectorAll('.emoji-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        this.responses[question.id] = {
          reactionId: btn.dataset.reactionId,
          type: btn.dataset.reactionType,
          dimensions: JSON.parse(btn.dataset.dimensions)
        };
      });
    });
  }

  // 7. PERCENTAGE ALLOCATOR
  renderPercentageAllocator(question, container) {
    const allocatorHTML = `
      <div class="percentage-allocator">
        <h3 class="question-prompt">${question.prompt}</h3>
        <div class="points-display">
          <span class="points-label">Points remaining:</span>
          <span class="points-left">100</span>
        </div>
        <div class="allocation-items">
          ${question.categories.map((cat, idx) => `
            <div class="allocation-item">
              <label for="alloc_${idx}">${cat.label}</label>
              <div class="allocation-control">
                <input type="range" 
                       id="alloc_${idx}"
                       class="allocation-slider" 
                       data-category-id="${idx}"
                       data-category="${cat.id}"
                       min="0" max="100" value="0">
                <input type="number" 
                       class="allocation-number" 
                       data-category-id="${idx}"
                       min="0" max="100" value="0">
                <span class="percentage-sign">%</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="allocation-visual">
          <canvas id="allocation-chart" width="300" height="300"></canvas>
        </div>
      </div>
    `;
    
    container.innerHTML = allocatorHTML;
    this.initializeAllocator(question.id, question.categories);
  }

  initializeAllocator(questionId, categories) {
    const sliders = document.querySelectorAll('.allocation-slider');
    const numbers = document.querySelectorAll('.allocation-number');
    const pointsLeft = document.querySelector('.points-left');
    const allocations = new Array(categories.length).fill(0);
    
    const updateAllocations = () => {
      const total = allocations.reduce((sum, val) => sum + val, 0);
      const remaining = 100 - total;
      pointsLeft.textContent = remaining;
      pointsLeft.style.color = remaining < 0 ? '#ef4444' : '#4a90e2';
      
      // Update chart
      this.drawAllocationChart(allocations, categories);
      
      // Save response
      this.responses[questionId] = categories.map((cat, idx) => ({
        category: cat.id,
        value: allocations[idx],
        dimensions: cat.dimensions
      }));
    };
    
    sliders.forEach((slider, idx) => {
      const number = numbers[idx];
      
      slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        allocations[idx] = value;
        number.value = value;
        updateAllocations();
      });
      
      number.addEventListener('input', (e) => {
        const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
        allocations[idx] = value;
        slider.value = value;
        number.value = value;
        updateAllocations();
      });
    });
  }

  drawAllocationChart(allocations, categories) {
    const canvas = document.getElementById('allocation-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = 150;
    const centerY = 150;
    const radius = 100;
    
    ctx.clearRect(0, 0, 300, 300);
    
    let startAngle = -Math.PI / 2;
    const colors = ['#4a90e2', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
    
    allocations.forEach((value, idx) => {
      if (value > 0) {
        const angle = (value / 100) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        ctx.closePath();
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
        
        // Label
        const labelAngle = startAngle + angle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius / 2);
        const labelY = centerY + Math.sin(labelAngle) * (radius / 2);
        
        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${value}%`, labelX, labelY);
        
        startAngle += angle;
      }
    });
  }

  // 8. TWO-PILE SORT
  renderTwoPileSort(question, container) {
    const sortHTML = `
      <div class="two-pile-sort">
        <h3 class="question-prompt">${question.prompt}</h3>
        <div class="sort-container">
          <div class="sort-items">
            <h4>Items to sort:</h4>
            <div class="items-pool">
              ${question.items.map((item, idx) => `
                <div class="sort-item" 
                     draggable="true" 
                     data-item-id="${idx}"
                     data-item-text="${item.text}">
                  ${item.text}
                </div>
              `).join('')}
            </div>
          </div>
          <div class="sort-piles">
            <div class="pile pile-a" data-pile="A">
              <h4>${question.pileA}</h4>
              <div class="pile-drop-zone" data-pile="A"></div>
            </div>
            <div class="pile pile-b" data-pile="B">
              <h4>${question.pileB}</h4>
              <div class="pile-drop-zone" data-pile="B"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = sortHTML;
    this.initializeTwoPileSort(question.id);
  }

  initializeTwoPileSort(questionId) {
    const items = document.querySelectorAll('.sort-item');
    const dropZones = document.querySelectorAll('.pile-drop-zone');
    const itemsPool = document.querySelector('.items-pool');
    let draggedItem = null;
    
    // Make items pool a drop zone too (for moving items back)
    itemsPool.addEventListener('dragover', (e) => e.preventDefault());
    itemsPool.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedItem) {
        itemsPool.appendChild(draggedItem);
      }
    });
    
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        e.target.classList.add('dragging');
      });
      
      item.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
      });
    });
    
    dropZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (draggedItem) {
          zone.appendChild(draggedItem);
          this.updateTwoPileResponse(questionId);
          draggedItem = null;
        }
      });
    });
  }

  updateTwoPileResponse(questionId) {
    const pileA = document.querySelector('.pile-a .pile-drop-zone');
    const pileB = document.querySelector('.pile-b .pile-drop-zone');
    
    this.responses[questionId] = {
      pileA: Array.from(pileA.children).map(item => ({
        id: item.dataset.itemId,
        text: item.dataset.itemText
      })),
      pileB: Array.from(pileB.children).map(item => ({
        id: item.dataset.itemId,
        text: item.dataset.itemText
      }))
    };
  }

  // Utility functions
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Get response for validation
  getResponse(questionId) {
    return this.responses[questionId] || null;
  }

  // Check if question is complete
  isQuestionComplete(questionId, questionType) {
    const response = this.responses[questionId];
    if (!response) return false;
    
    switch(questionType) {
      case 'likert_grid':
        return Object.keys(response).length === 5; // All 5 statements rated
      case 'sliding_spectrum':
        return Object.keys(response).length === 3; // All 3 spectrums set
      case 'word_cloud':
        return response.length === 5; // Exactly 5 words selected
      case 'percentage_allocator':
        const total = response.reduce((sum, r) => sum + r.value, 0);
        return total === 100;
      case 'two_pile_sort':
        const totalItems = (response.pileA?.length || 0) + (response.pileB?.length || 0);
        return totalItems === 8; // All items sorted
      default:
        return response !== null && response !== undefined;
    }
  }
}

// Make available globally
window.InteractiveQuestionComponents = InteractiveQuestionComponents;
