import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import StatCard from '../../shared/StatCard';
import { useAuth } from '../../../context/AuthContext';
import { founderAPI } from '../../../services/api';

// Clear legacy localStorage cache that caused stale data to persist
try { localStorage.removeItem('startupData'); } catch {}

const STAGES = [
  { key: 'idea',     title: 'Idea Validation' },
  { key: 'problem',  title: 'Problem Definition' },
  { key: 'solution', title: 'Solution Development' },
  { key: 'market',   title: 'Market Validation' },
  { key: 'business', title: 'Business Model Validation' },
];

export default function DashboardPage({ startup: startupProp, refetch, isLoading: parentLoading }) {
  const { user } = useAuth();

  // Use startup from parent (React Query) — no localStorage cache.
  // localStorage was causing stale data to show when validationStages or other
  // fields changed on the backend but the cached object wasn't refreshed.
  const [startup, setStartup]   = useState(startupProp ?? null);
  const [loading, setLoading]   = useState(!startupProp && parentLoading !== false);

  // Sync with parent startup prop whenever it updates
  useEffect(() => {
    if (startupProp !== undefined) {
      setStartup(startupProp);
      setLoading(false);
    }
  }, [startupProp]);

  // If no parent prop at all, fetch ourselves (fallback for direct mount)
  useEffect(() => {
    if (startupProp === undefined) {
      founderAPI.getMyStartup()
        .then(data => { if (data) setStartup(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed stats ──────────────────────────────────────────────────────────
  const validationStages = startup?.validationStages || {};
  let validatedCount = 0;
  STAGES.forEach(({ key }) => { if (validationStages[key]?.isValidated) validatedCount++; });
  const totalStages = STAGES.length;
  const completionPercent = Math.round((validatedCount / totalStages) * 100);

  const roadmapTasks = startup?.roadmapTasks || [];
  const completedTasks = roadmapTasks.filter(t => t.status === 'completed').length;
  const totalTasks = roadmapTasks.length || 15;

  const rewardPoints = user?.rewardPoints ?? 0;
  const allCompleted = validatedCount === totalStages;

  const getStageStatus = (stage, index) => {
    if (!startup) return { text: 'Create Startup', cls: 'status-pending', score: '--' };
    const rec = validationStages[stage.key];
    const done = !!rec?.completedAt;
    const passed = !!rec?.isValidated;
    let locked = index > 0 && !validationStages[STAGES[index - 1].key]?.isValidated;
    if (index === 0) locked = false;
    return {
      text: locked ? 'Locked' : !done ? 'Not Started' : passed ? 'Validated' : 'Needs Improvement',
      cls: locked ? 'status-pending' : !done ? 'status-pending' : passed ? 'status-approved' : 'status-submitted',
      score: done ? `${rec.score}%` : '--',
    };
  };

  if (loading || parentLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto 1rem' }} />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Track your startup validation progress" />

      {/* Progress Card */}
      <Card style={{ borderLeft: '4px solid var(--primary)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {startup?.name || 'My Startup'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {completionPercent}% Complete ({validatedCount}/{totalStages} stages validated)
            </p>
          </div>
          <span className={`list-item-status ${allCompleted ? 'status-approved' : 'status-pending'}`}>
            {allCompleted ? `${startup?.validationScore || 0}% Overall` : 'Overall: Pending'}
          </span>
        </div>
        <div style={{ height: '8px', background: 'var(--bg-hover)', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completionPercent}%`, background: 'var(--primary)', borderRadius: '9999px', transition: 'width 0.5s ease' }} />
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard value={`${validatedCount}/${totalStages}`} label="Stages Completed" index={0} />
        <StatCard value={`${completedTasks}/${totalTasks}`} label="Tasks Completed" index={1} />
        <StatCard value={rewardPoints} label="Reward Points" index={2} />
      </div>

      {/* Validation Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Roadmap</CardTitle>
        </CardHeader>
        <div className="list">
          {STAGES.map((stage, index) => {
            const s = getStageStatus(stage, index);
            return (
              <div key={stage.key} className="list-item">
                <div className="list-item-content">
                  <div className="list-item-title">{stage.title}</div>
                  <div className="list-item-subtitle">Score: {s.score}</div>
                </div>
                <span className={`list-item-status ${s.cls}`}>{s.text}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Create Startup prompt */}
      {!startup && (
        <Card style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            You haven't created a startup yet. Go to <strong>Startup Profile</strong> to get started.
          </p>
          <button className="btn btn-primary" onClick={() => { window.location.hash = 'profile'; }}>
            Create Startup
          </button>
        </Card>
      )}
    </div>
  );
}
