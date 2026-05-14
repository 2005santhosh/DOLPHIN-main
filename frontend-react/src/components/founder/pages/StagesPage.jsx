import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI } from '../../../services/api';

const VALIDATION_STAGES = [
  { key: 'idea', title: '💡 Idea Validation', description: 'Answer 10 questions about your idea. AI will evaluate your responses.' },
  { key: 'problem', title: '🧩 Problem Definition', description: 'Validate that the problem is real, painful, frequent, and backed by evidence.' },
  { key: 'solution', title: '🛠️ Solution Development', description: 'Validate the solution approach, MVP scope, differentiators, and feasibility.' },
  { key: 'market', title: '📈 Market Validation', description: 'Validate market size, distribution channels, competitors, and willingness-to-pay.' },
  { key: 'business', title: '💼 Business Model Validation', description: 'Validate pricing, unit economics, margins, CAC/LTV assumptions, and scalability.' }
];

const StagesPage = () => {
  const [startup, setStartup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [stageResults, setStageResults] = useState(null);

  useEffect(() => {
    loadStages();
  }, []);

  const loadStages = async () => {
    try {
      const startupData = await founderAPI.getMyStartup();
      setStartup(startupData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading stages:', error);
      setLoading(false);
    }
  };

  const openValidationModal = async (stageKey) => {
    setCurrentStage(stageKey);
    setAnswers({});
    try {
      const response = await founderAPI.getStageQuestions(stageKey);
      if (response.success) {
        setQuestions(response.questions || []);
        setModalOpen(true);
      } else {
        toast.error(response.message || 'Failed to load questions');
      }
    } catch (error) {
      toast.error('Failed to load validation questions');
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const submitValidation = async (e) => {
    e.preventDefault();
    
    // Validate all questions are answered
    const allAnswered = questions.every(q => answers[q.id]?.trim());
    if (!allAnswered) {
      toast.error('Please answer all questions');
      return;
    }

    setSubmitting(true);

    const formattedAnswers = questions.map(q => ({
      id: q.id,
      answer: answers[q.id].trim(),
      category: q.category
    }));

    try {
      const result = await founderAPI.submitStageValidation(currentStage, formattedAnswers);
      if (result.success) {
        setModalOpen(false);
        toast.success(
          result.isValidated
            ? `✓ Stage Validated (${result.validationScore}%)`
            : `Stage Score: ${result.validationScore}% (need 70%)`
        );
        loadStages();
      } else {
        toast.error(`Error: ${result.message || 'Validation failed'}`);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit validation');
    } finally {
      setSubmitting(false);
    }
  };

  const showResults = async (stageKey) => {
    // Use already-loaded startup data
    const rec = startup?.validationStages?.[stageKey];
    if (!rec || !rec.completedAt) {
      toast('No results yet for this stage.', { icon: 'ℹ️' });
      return;
    }
    setStageResults({ stageKey, ...rec });
    setResultsModalOpen(true);
  };

  const getStageStatus = (stage, index) => {
    if (!startup) {
      return { text: 'Create Startup', className: 'status-pending', locked: true, hasCompleted: false };
    }

    const validationStages = startup.validationStages || {};
    const rec = validationStages[stage.key];
    const hasCompleted = !!rec?.completedAt;
    const passed = !!rec?.isValidated;

    let locked = index > 0;
    if (index === 0) locked = false;
    if (index > 0) {
      const prevKey = VALIDATION_STAGES[index - 1].key;
      locked = !validationStages?.[prevKey]?.isValidated;
    }

    const statusText = locked ? 'Locked' : !hasCompleted ? 'Not Started' : passed ? '✓ Validated' : 'Needs Improvement';
    const statusClass = locked ? 'status-pending' : !hasCompleted ? 'status-pending' : passed ? 'status-approved' : 'status-submitted';

    return { text: statusText, className: statusClass, locked, hasCompleted, passed };
  };

  const getOverallScore = () => {
    if (!startup) return null;

    const validationStages = startup.validationStages || {};
    const completedCount = VALIDATION_STAGES.filter(s => validationStages[s.key]?.completedAt).length;
    const allCompleted = completedCount === VALIDATION_STAGES.length;

    return {
      allCompleted,
      completedCount,
      score: startup.validationScore || 0
    };
  };

  if (loading) {
    return <LoadingSpinner message="Loading validation stages..." />;
  }

  const overallScore = getOverallScore();

  return (
    <div>
      <PageHeader 
        title="Validation Stages" 
        subtitle="Complete each stage to validate your startup idea" 
      />

      {/* Overall Validation Summary */}
      {overallScore && overallScore.allCompleted && (
        <Card style={{ marginBottom: '1.25rem' }}>
          <CardHeader>
            <CardTitle>Overall Validation Score</CardTitle>
          </CardHeader>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
            {overallScore.score}% (final score)
          </p>
        </Card>
      )}

      {/* Stage Cards */}
      <div className="list">
        {VALIDATION_STAGES.map((stage, index) => {
          const status = getStageStatus(stage, index);
          
          return (
            <Card key={stage.key} style={{ marginBottom: '1.25rem' }}>
              <CardHeader>
                <CardTitle>
                  {stage.title}{' '}
                  <span className={`list-item-status ${status.className}`} style={{ marginLeft: '10px' }}>
                    {status.text}
                  </span>
                </CardTitle>
              </CardHeader>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {stage.description}
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => openValidationModal(stage.key)}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={status.locked}
                >
                  {status.locked ? 'Locked' : 'Start'}
                </button>
                {status.hasCompleted && (
                  <button
                    onClick={() => showResults(stage.key)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    View Results
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Validation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={`Validate: ${VALIDATION_STAGES.find(s => s.key === currentStage)?.title || ''}`}
        maxWidth="700px"
      >
        {submitting ? (
          <LoadingSpinner message="AI is evaluating your answers..." />
        ) : (
          <form onSubmit={submitValidation}>
            <div id="validation-questions-container">
              {questions.map((q) => (
                <div key={q.id} style={{ marginBottom: '2rem' }}>
                  <div style={{
                    background: 'var(--bg-surface-2)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '0.5rem',
                    border: '1px solid var(--border-color)'
                  }}>
                    <label className="form-label" style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      <strong>Q{q.id}:</strong> {q.question}
                    </label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      {q.hint}
                    </p>
                    <textarea
                      className="form-textarea"
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Your answer..."
                      style={{ marginBottom: 0, minHeight: '100px' }}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Submit for AI Evaluation
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        title={VALIDATION_STAGES.find(s => s.key === stageResults?.stageKey)?.title || 'Results'}
      >
        {stageResults && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '3.5rem',
                fontWeight: 800,
                color: stageResults.score >= 70 ? 'var(--success)' : 'var(--error)',
                lineHeight: 1
              }}>
                {stageResults.score}%
              </div>
              <div style={{
                display: 'inline-block',
                marginTop: '0.5rem',
                padding: '4px 12px',
                background: `${stageResults.score >= 70 ? 'var(--success)' : 'var(--error)'}20`,
                color: stageResults.score >= 70 ? 'var(--success)' : 'var(--error)',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                {stageResults.score >= 70 ? 'Validated' : 'Needs Improvement'}
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
                Answer Breakdown
              </h4>
              {(stageResults.answers || []).map((a, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Question {idx + 1}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      color: a.score >= 7 ? 'var(--success)' : 'var(--error)'
                    }}>
                      {a.score}/10
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.5
                  }}>
                    {(a.answer || '').substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StagesPage;
