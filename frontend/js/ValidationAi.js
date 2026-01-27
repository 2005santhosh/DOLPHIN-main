// Updated validation modal JavaScript - AI scoring only, no manual sliders

async function openStageValidationModal(stageKey) {
  const modal = document.getElementById('idea-validation-modal');
  const container = document.getElementById('validation-questions-container');
  const titleEl = document.getElementById('stage-validation-modal-title');
  const token = localStorage.getItem('token');

  modal.dataset.stageKey = stageKey;
  titleEl.textContent = `Validate: ${VALIDATION_STAGES.find(s => s.key === stageKey)?.title || stageKey}`;

  try {
    const response = await fetch(`/api/founder/validate-stage/${stageKey}/questions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.success) {
      alert(data.message || 'Failed to load questions');
      return;
    }

    const questions = data.questions || [];
    container.innerHTML = '';

    // Display AI scoring notice
    const notice = document.createElement('div');
    notice.style.cssText = 'background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 1.5rem; border-radius: 8px;';
    notice.innerHTML = `
      <div style="display: flex; align-items: start; gap: 0.75rem;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div>
          <strong style="color: #1e40af;">AI-Powered Evaluation</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #1e3a8a;">
            Your answers will be reviewed and scored by AI based on specificity, evidence, depth, and quality. 
            Focus on providing detailed, honest responses.
          </p>
        </div>
      </div>
    `;
    container.appendChild(notice);

    questions.forEach((q) => {
      const questionDiv = document.createElement('div');
      questionDiv.style.marginBottom = '1.75rem';
      questionDiv.innerHTML = `
        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb;">
          <label class="form-label" style="margin-bottom: 0.5rem; display: block;">
            <strong style="color: #111827;">Q${q.id}:</strong> ${q.question}
          </label>
          <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem;">💡 ${q.hint}</p>
          
          <textarea 
            class="form-textarea validation-answer" 
            data-question-id="${q.id}" 
            data-category="${q.category}"
            data-weight="${q.weight}"
            placeholder="Type your detailed answer here... (AI will evaluate quality, specificity, and evidence)"
            style="margin-bottom: 0; resize: vertical; min-height: 100px; font-size: 0.95rem;"
            oninput="updateAnswerProgress()"
          ></textarea>
          
          <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280;">
            <span id="char-count-${q.id}">0 characters</span> 
            <span style="margin-left: 0.5rem;">·</span>
            <span style="margin-left: 0.5rem;">Weight: ${Math.round(q.weight * 100)}%</span>
          </div>
        </div>
      `;
      container.appendChild(questionDiv);
    });

    // Update character counters
    document.querySelectorAll('.validation-answer').forEach(textarea => {
      const qId = textarea.dataset.questionId;
      textarea.addEventListener('input', () => {
        const count = textarea.value.length;
        const countEl = document.getElementById(`char-count-${qId}`);
        if (countEl) {
          countEl.textContent = `${count} characters`;
          if (count < 50) {
            countEl.style.color = '#dc2626';
          } else if (count < 100) {
            countEl.style.color = '#ea580c';
          } else {
            countEl.style.color = '#059669';
          }
        }
      });
    });

    document.getElementById('validation-progress').style.display = 'block';
    document.getElementById('idea-validation-form').onsubmit = submitStageValidation;

    // Reset progress
    document.getElementById('validation-estimated-score').textContent = 'AI will evaluate';
    document.getElementById('validation-estimated-score').style.color = '#6b7280';
    document.getElementById('validation-progress-text').textContent = '0/10';
    document.getElementById('validation-progress-fill').style.width = '0%';

    modal.classList.add('active');
  } catch (error) {
    console.error('Error loading questions:', error);
    alert('Failed to load validation questions');
  }
}

function updateAnswerProgress() {
  const allAnswers = document.querySelectorAll('.validation-answer');
  const answeredCount = Array.from(allAnswers).filter(a => a.value.trim().length >= 10).length;
  const totalQuestions = allAnswers.length || 10;

  const percent = Math.round((answeredCount / totalQuestions) * 100);
  const progressText = document.getElementById('validation-progress-text');
  const progressFill = document.getElementById('validation-progress-fill');

  if (progressText) progressText.textContent = `${answeredCount}/${totalQuestions} answered`;
  if (progressFill) progressFill.style.width = `${percent}%`;

  // Update estimated score message
  const estEl = document.getElementById('validation-estimated-score');
  if (estEl) {
    if (answeredCount === totalQuestions) {
      estEl.textContent = 'Ready to submit for AI evaluation';
      estEl.style.color = '#059669';
    } else {
      estEl.textContent = `${totalQuestions - answeredCount} questions remaining`;
      estEl.style.color = '#6b7280';
    }
  }
}

async function submitStageValidation(e) {
  e.preventDefault();

  const modal = document.getElementById('idea-validation-modal');
  const stageKey = modal.dataset.stageKey;
  const token = localStorage.getItem('token');

  const answers = [];
  const answerElements = document.querySelectorAll('.validation-answer');

  // Validate all answers are filled
  for (let elem of answerElements) {
    if (elem.value.trim().length < 10) {
      alert('Please provide detailed answers (at least 10 characters) for all questions');
      elem.focus();
      return;
    }
  }

  // Collect answers (no manual scores - AI will score them)
  answerElements.forEach(answerElem => {
    const questionId = parseInt(answerElem.dataset.questionId);
    answers.push({
      id: questionId,
      answer: answerElem.value.trim(),
      category: answerElem.dataset.category
    });
  });

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '🤖 AI is evaluating your answers...';
  submitBtn.style.opacity = '0.7';

  try {
    const response = await fetch(`/api/founder/validate-stage/${stageKey}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers })
    });

    const result = await response.json();

    if (result.success) {
      closeIdeaValidationModal();

      // Build detailed feedback message
      const lines = [];
      lines.push(result.message || 'Validation complete');
      lines.push('');
      
      if (result.overallFeedback) {
        lines.push('📊 AI Feedback:');
        lines.push(result.overallFeedback);
        lines.push('');
      }

      if (result.totalValidationScore > 0) {
        lines.push(`Overall Validation Score: ${result.totalValidationScore}%`);
      } else {
        lines.push('Overall Validation Score: Pending (complete all 5 stages)');
      }

      alert(lines.join('\n'));

      // Reload dashboard and stages
      if (typeof loadStages === 'function') loadStages();
      if (typeof loadDashboard === 'function') loadDashboard();
    } else {
      alert(`Error: ${result.message || 'Validation failed'}`);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      submitBtn.style.opacity = '1';
    }
  } catch (error) {
    console.error('Error submitting validation:', error);
    alert('Failed to submit validation. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    submitBtn.style.opacity = '1';
  }
}

function closeIdeaValidationModal() {
  document.getElementById('idea-validation-modal').classList.remove('active');
}

async function showStageValidationResults(stageKey) {
  const token = localStorage.getItem('token');
  
  try {
    const startup = await api.getStartup();
    const rec = startup?.validationStages?.[stageKey];

    if (!rec || !rec.completedAt) {
      alert('No results yet for this stage.');
      return;
    }

    const lines = [];
    lines.push(`═══ ${VALIDATION_STAGES.find(s => s.key === stageKey)?.title || stageKey} ═══`);
    lines.push('');
    lines.push(`AI Score: ${rec.score}%`);
    lines.push(`Status: ${rec.isValidated ? '✓ Validated' : '✗ Needs Improvement'}`);
    lines.push(`Completed: ${new Date(rec.completedAt).toLocaleDateString()}`);
    lines.push('');

    if (rec.overallFeedback) {
      lines.push('AI Feedback:');
      lines.push(rec.overallFeedback);
      lines.push('');
    }

    const completedCount = VALIDATION_STAGES
      .map(s => startup?.validationStages?.[s.key])
      .filter(v => v && v.completedAt)
      .length;
    const allCompleted = completedCount === VALIDATION_STAGES.length;

    lines.push(allCompleted
      ? `Overall Score: ${startup.validationScore}% (all stages complete)`
      : `Overall Score: Pending (${completedCount}/5 stages complete)`);
    lines.push('');
    lines.push('─── Individual Question Scores ───');

    (rec.answers || []).forEach((a, idx) => {
      lines.push('');
      lines.push(`Q${idx + 1}: ${a.question || 'Question ' + (idx + 1)}`);
      lines.push(`Score: ${a.score}%`);
      
      if (a.feedback) {
        lines.push(`Feedback: ${a.feedback}`);
      }
      
      if (a.strengths && a.strengths.length > 0) {
        lines.push('Strengths: ' + a.strengths.join('; '));
      }
      
      if (a.improvements && a.improvements.length > 0) {
        lines.push('Improvements: ' + a.improvements.join('; '));
      }
      
      const answerPreview = (a.answer || '').slice(0, 100);
      lines.push(`Answer: ${answerPreview}${a.answer.length > 100 ? '...' : ''}`);
    });

    // Display in a scrollable alert or modal
    alert(lines.join('\n'));
  } catch (error) {
    console.error('Failed to load results:', error);
    alert('Failed to load results');
  }
}

// Backwards compatibility
function openIdeaValidationModal() {
  return openStageValidationModal('idea');
}

function showValidationResults() {
  return showStageValidationResults('idea');
}

// Remove these old functions that are no longer needed
function updateScoreDisplay() {
  // No-op - manual scoring removed
}