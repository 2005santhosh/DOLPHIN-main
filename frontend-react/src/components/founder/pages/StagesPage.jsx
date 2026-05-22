import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI } from '../../../services/api';
import { Lightbulb, Puzzle, Wrench, TrendingUp, Briefcase } from '../../shared/Icons';

const VALIDATION_STAGES = [
  { key: 'idea',     title: 'Idea Validation',           icon: <Lightbulb size={18} />, description: 'Answer 10 questions about your idea. AI will evaluate your responses.' },
  { key: 'problem',  title: 'Problem Definition',        icon: <Puzzle size={18} />,    description: 'Validate that the problem is real, painful, frequent, and backed by evidence.' },
  { key: 'solution', title: 'Solution Development',      icon: <Wrench size={18} />,    description: 'Validate the solution approach, MVP scope, differentiators, and feasibility.' },
  { key: 'market',   title: 'Market Validation',         icon: <TrendingUp size={18} />,description: 'Validate market size, distribution channels, competitors, and willingness-to-pay.' },
  { key: 'business', title: 'Business Model Validation', icon: <Briefcase size={18} />, description: 'Validate pricing, unit economics, margins, CAC/LTV assumptions, and scalability.' },
];

// ─── Score display component shown after evaluation ───────────────────────────
const ScoreResult = ({ result, stageKey, onClose, onRetry }) => {
  const score = result.validationScore ?? 0;
  const validated = result.isValidated ?? (score >= 70);
  const answers = result.processedAnswers || [];
  const feedback = result.overallFeedback || '';
  const stageTitle = VALIDATION_STAGES.find(s => s.key === stageKey)?.title || '';

  return (
    <div>
      {/* Score hero */}
      <div style={{
        textAlign: 'center',
        padding: '1.5rem',
        background: validated ? '#F0FDF4' : '#FFF7ED',
        borderRadius: 12,
        marginBottom: '1.5rem',
        border: `2px solid ${validated ? '#86EFAC' : '#FED7AA'}`,
      }}>
        <div style={{
          fontSize: '4rem', fontWeight: 900, lineHeight: 1,
          color: validated ? '#16A34A' : '#EA580C',
        }}>
          {score}%
        </div>
        <div style={{
          marginTop: '0.5rem',
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '4px 14px', borderRadius: 9999,
          background: validated ? '#DCFCE7' : '#FFEDD5',
          color: validated ? '#15803D' : '#C2410C',
          fontWeight: 700, fontSize: '0.9rem',
        }}>
          {validated ? '🎉 Stage Validated!' : '📊 Needs Improvement'}
        </div>
        {feedback && (
          <p style={{ marginTop: '0.75rem', color: '#374151', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {feedback}
          </p>
        )}
        {!validated && (
          <p style={{ marginTop: '0.5rem', color: '#6B7280', fontSize: '0.8rem' }}>
            Score 70% or above to unlock the next stage.
          </p>
        )}
      </div>

      {/* Per-answer breakdown */}
      {answers.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#111827' }}>
            Answer Breakdown
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: 320, overflowY: 'auto' }}>
            {answers.map((a, idx) => (
              <div key={idx} style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: 8, padding: '0.75rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
                    Q{idx + 1}: {a.question?.substring(0, 60)}{a.question?.length > 60 ? '…' : ''}
                  </span>
                  <span style={{
                    fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, marginLeft: '0.5rem',
                    color: a.score >= 70 ? '#16A34A' : a.score >= 50 ? '#D97706' : '#DC2626',
                  }}>
                    {a.score}/100
                  </span>
                </div>
                {a.feedback && (
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.4 }}>
                    {a.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
        <button className="btn btn-primary" onClick={onClose} style={{ flex: 1 }}>
          {validated ? 'Continue →' : 'Close'}
        </button>
        {!validated && (
          <button className="btn btn-secondary" onClick={onRetry} style={{ flex: 1 }}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const StagesPage = () => {
  const [startup, setStartup] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal state — 'questions' | 'evaluating' | 'result' | null
  const [modalState, setModalState] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [evalResult, setEvalResult] = useState(null); // result from API

  // Results viewer (for already-completed stages)
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [stageResults, setStageResults] = useState(null);

  useEffect(() => { loadStages(); }, []);

  const loadStages = async () => {
    try {
      const data = await founderAPI.getMyStartup();
      setStartup(data);
    } catch (err) {
      console.error('Error loading stages:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Open the question form ──────────────────────────────────────────────────
  const openValidationModal = async (stageKey) => {
    setCurrentStage(stageKey);
    setAnswers({});
    setEvalResult(null);
    try {
      const response = await founderAPI.getStageQuestions(stageKey);
      setQuestions(response.questions || []);
      setModalState('questions');
    } catch {
      toast.error('Failed to load questions');
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // ── Submit answers ──────────────────────────────────────────────────────────
  const submitValidation = async (e) => {
    e.preventDefault();

    const unanswered = questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      toast.error(`Please answer all ${questions.length} questions`);
      return;
    }

    // Switch to evaluating state immediately — hides the form, shows spinner
    setModalState('evaluating');

    const formattedAnswers = questions.map(q => ({
      id: q.id,
      answer: answers[q.id].trim(),
      category: q.category,
    }));

    try {
      const result = await founderAPI.submitStageValidation(currentStage, formattedAnswers);

      // Update startup state directly from the response — no re-fetch needed
      // The backend returns the new score and validation status
      const score = result.validationScore ?? 0;
      const validated = result.isValidated ?? (score >= 70);

      // Patch the local startup state so stage cards update immediately
      setStartup(prev => {
        if (!prev) return prev;
        const updatedStages = {
          ...(prev.validationStages || {}),
          [currentStage]: {
            score,
            isValidated: validated,
            completedAt: new Date().toISOString(),
            overallFeedback: result.overallFeedback || '',
            answers: result.processedAnswers || [],
          },
        };
        // Compute new overall validation score
        const STAGE_KEYS = ['idea', 'problem', 'solution', 'market', 'business'];
        const completed = STAGE_KEYS.map(k => updatedStages[k]).filter(v => v?.completedAt && typeof v.score === 'number');
        const newOverall = completed.length > 0
          ? Math.round(completed.reduce((s, v) => s + v.score, 0) / completed.length)
          : 0;

        return {
          ...prev,
          validationStages: updatedStages,
          validationScore: newOverall,
          currentStage: validated
            ? Math.max(prev.currentStage || 1, STAGE_KEYS.indexOf(currentStage) + 2)
            : prev.currentStage,
        };
      });

      // Store result and switch to result view
      setEvalResult(result);
      setModalState('result');
    } catch (err) {
      console.error('Validation error:', err);
      toast.error(err.message || 'Evaluation failed. Please try again.');
      // Go back to questions so user can retry
      setModalState('questions');
    }
  };

  // ── Close / retry ───────────────────────────────────────────────────────────
  const closeModal = () => {
    setModalState(null);
    setCurrentStage(null);
    setAnswers({});
    setEvalResult(null);
  };

  const retryValidation = () => {
    setEvalResult(null);
    setModalState('questions');
  };

  // ── View results for a completed stage ─────────────────────────────────────
  const showResults = (stageKey) => {
    const rec = startup?.validationStages?.[stageKey];
    if (!rec?.completedAt) {
      toast('No results yet for this stage.', { icon: 'ℹ️' });
      return;
    }
    setStageResults({ stageKey, ...rec });
    setResultsModalOpen(true);
  };

  // ── Stage status helpers ────────────────────────────────────────────────────
  const getStageStatus = (stage, index) => {
    if (!startup) return { text: 'Create Startup', className: 'status-pending', locked: true, hasCompleted: false };

    const vs = startup.validationStages || {};
    const rec = vs[stage.key];
    const hasCompleted = !!rec?.completedAt;
    const passed = !!rec?.isValidated;

    const locked = index > 0 && !vs[VALIDATION_STAGES[index - 1].key]?.isValidated;

    const statusText = locked ? 'Locked' : !hasCompleted ? 'Not Started' : passed ? '✓ Validated' : 'Needs Improvement';
    const statusClass = locked ? 'status-pending' : !hasCompleted ? 'status-pending' : passed ? 'status-approved' : 'status-submitted';

    return { text: statusText, className: statusClass, locked, hasCompleted, passed };
  };

  if (loading) return <LoadingSpinner message="Loading validation stages..." />;

  const overallScore = startup?.validationScore || 0;
  const completedCount = VALIDATION_STAGES.filter(s => startup?.validationStages?.[s.key]?.completedAt).length;
  const allCompleted = completedCount === VALIDATION_STAGES.length;

  const modalTitle = modalState === 'result'
    ? `Results: ${VALIDATION_STAGES.find(s => s.key === currentStage)?.title || ''}`
    : `Validate: ${VALIDATION_STAGES.find(s => s.key === currentStage)?.title || ''}`;

  return (
    <div>
      <PageHeader title="Validation Stages" subtitle="Complete each stage to validate your startup idea" />

      {/* Overall score banner */}
      {completedCount > 0 && (
        <Card style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: 4 }}>Overall Validation Score</div>
              <div style={{ color: 'white', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{overallScore}%</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginTop: 4 }}>
                {completedCount}/{VALIDATION_STAGES.length} stages completed
                {allCompleted && ' · All stages done!'}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 9999, background: '#84CC16',
                  width: `${overallScore}%`, transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginTop: 4 }}>
                {overallScore >= 70 ? '✓ Visible to investors' : `${70 - overallScore}% more to reach investor visibility`}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stage cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {VALIDATION_STAGES.map((stage, index) => {
          const status = getStageStatus(stage, index);
          const rec = startup?.validationStages?.[stage.key];

          return (
            <Card key={stage.key}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    {stage.icon}
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>{stage.title}</span>
                    <span className={`list-item-status ${status.className}`}>{status.text}</span>
                    {rec?.score != null && (
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 700,
                        color: rec.isValidated ? '#16A34A' : '#D97706',
                        background: rec.isValidated ? '#DCFCE7' : '#FEF3C7',
                        padding: '2px 8px', borderRadius: 9999,
                      }}>
                        {rec.score}%
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                    {stage.description}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {status.hasCompleted && (
                    <button onClick={() => showResults(stage.key)} className="btn btn-secondary btn-sm">
                      Results
                    </button>
                  )}
                  <button
                    onClick={() => openValidationModal(stage.key)}
                    className="btn btn-primary btn-sm"
                    disabled={status.locked}
                  >
                    {status.locked ? '🔒 Locked' : status.hasCompleted ? 'Retry' : 'Start'}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Validation modal (questions / evaluating / result) ── */}
      <Modal
        isOpen={!!modalState}
        onClose={() => modalState !== 'evaluating' && closeModal()}
        title={modalTitle}
        maxWidth="700px"
      >
        {/* EVALUATING */}
        {modalState === 'evaluating' && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <LoadingSpinner message="AI is evaluating your answers…" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '1rem', lineHeight: 1.6 }}>
              This usually takes 5–15 seconds.<br />Please don't close this window.
            </p>
          </div>
        )}

        {/* RESULT */}
        {modalState === 'result' && evalResult && (
          <ScoreResult
            result={evalResult}
            stageKey={currentStage}
            onClose={closeModal}
            onRetry={retryValidation}
          />
        )}

        {/* QUESTIONS FORM */}
        {modalState === 'questions' && (
          <form onSubmit={submitValidation}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {questions.map((q) => (
                <div key={q.id} style={{
                  background: 'var(--bg-surface-2, #F9FAFB)',
                  padding: '1rem',
                  borderRadius: 10,
                  border: '1px solid var(--border-color, #E5E7EB)',
                }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem', color: 'var(--text-primary)', display: 'block' }}>
                    <strong>Q{q.id}:</strong> {q.question}
                  </label>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.625rem', lineHeight: 1.4 }}>
                    💡 {q.hint}
                  </p>
                  <textarea
                    className="form-textarea"
                    value={answers[q.id] || ''}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    placeholder="Your answer…"
                    style={{ marginBottom: 0, minHeight: '90px' }}
                    required
                  />
                  {answers[q.id]?.trim() && (
                    <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '3px', textAlign: 'right' }}>
                      {answers[q.id].trim().split(/\s+/).length} words
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Submit for AI Evaluation
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Results viewer for completed stages ── */}
      <Modal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        title={VALIDATION_STAGES.find(s => s.key === stageResults?.stageKey)?.title || 'Results'}
        maxWidth="600px"
      >
        {stageResults && (
          <ScoreResult
            result={{
              validationScore: stageResults.score,
              isValidated: stageResults.isValidated,
              overallFeedback: stageResults.overallFeedback,
              processedAnswers: stageResults.answers || [],
            }}
            stageKey={stageResults.stageKey}
            onClose={() => setResultsModalOpen(false)}
            onRetry={() => { setResultsModalOpen(false); openValidationModal(stageResults.stageKey); }}
          />
        )}
      </Modal>
    </div>
  );
};

export default StagesPage;
