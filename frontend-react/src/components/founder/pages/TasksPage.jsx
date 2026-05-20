import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { founderAPI } from '../../../services/api';
import { Lock } from '../../shared/Icons';

const TasksPage = () => {
  const { user, refreshProfile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const result = await founderAPI.getRoadmap();
      if (!result.unlocked) {
        setLocked(true);
        setTasks([]);
      } else {
        setLocked(false);
        setTasks(result.tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskKey) => {
    if (!window.confirm('Mark this task as complete?')) return;
    try {
      const result = await founderAPI.completeRoadmapTask(taskKey);
      toast.success(result.message || `Task completed! +${result.pointsEarned || 0} pts`);
      if (refreshProfile) refreshProfile().catch(() => {});
      loadTasks();
    } catch (error) {
      toast.error(error.message || 'Failed to complete task');
    }
  };

  const getStatusButton = (task) => {
    if (task.status === 'locked') {
      return (
        <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>
          Locked
        </span>
      );
    }

    if (task.status === 'completed') {
      return (
        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
          Done +{task.points} Pts
        </span>
      );
    }

    return (
      <button
        className="btn btn-primary btn-sm"
        onClick={() => completeTask(task.key)}
      >
        Mark Complete
      </button>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading growth roadmap..." />;
  }

  return (
    <div>
      <PageHeader
        title="Growth Roadmap"
        subtitle="Your step-by-step journey from Idea to Launch"
      />

      {locked && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Lock size={18} /> Complete all 5 Validation Stages to unlock your Growth Roadmap.
          </p>
        </Card>
      )}

      {!locked && tasks.length === 0 && (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No tasks available.
          </p>
        </Card>
      )}

      {!locked && tasks.length > 0 && (
        <div id="tasks-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          {tasks.map((task) => (
            <div
              key={task.key}
              className={`roadmap-item ${task.status}`}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                width: '100%',
                transition: 'border-color 0.2s',
                ...(task.status === 'completed' && { borderLeft: '4px solid var(--success)' }),
                ...(task.status === 'locked' && { opacity: 0.5 })
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  marginBottom: '0.25rem'
                }}>
                  {task.phase}
                </div>
                <h4 style={{
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '4px'
                }}>
                  {task.title}
                </h4>
                <p style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)'
                }}>
                  {task.description}
                </p>
              </div>
              <div style={{ minWidth: '120px', textAlign: 'right' }}>
                {getStatusButton(task)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TasksPage;
