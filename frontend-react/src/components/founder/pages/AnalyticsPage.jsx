import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar, Doughnut } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, ArcElement, PointElement, LineElement, Filler, Tooltip, Legend);

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    try {
      const result = await founderAPI.getAnalytics();
      setAnalytics(result.analytics || result);
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  if (!analytics) {
    return (
      <div>
        <PageHeader 
          title="Analytics" 
          subtitle="Track your startup's performance metrics" 
        />
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No analytics data available yet.
          </p>
        </Card>
      </div>
    );
  }

  const tasksData = analytics.growthTasks || { completed: 0, total: 0, pending: 0 };
  const stageData = analytics.stagePerformance || { labels: [], scores: [] };

  // Radar Chart Data
  const radarData = {
    labels: stageData.labels || [],
    datasets: [
      {
        label: 'Score',
        data: stageData.scores || [],
        backgroundColor: 'rgba(132, 204, 22, 0.15)',
        borderColor: '#84CC16',
        pointBackgroundColor: '#84CC16',
        pointBorderColor: '#84CC16',
        borderWidth: 2,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(0, 0, 0, 0.06)' },
        angleLines: { color: 'rgba(0, 0, 0, 0.06)' },
        pointLabels: { 
          color: '#64748B', 
          font: { size: 11 } 
        },
        ticks: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  // Doughnut Chart Data
  const doughnutData = {
    labels: ['Completed', 'Pending'],
    datasets: [
      {
        data: [tasksData.completed, tasksData.pending],
        backgroundColor: ['#34D399', 'rgba(0, 0, 0, 0.08)'],
        borderColor: ['transparent', 'transparent'],
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { 
          color: '#64748B', 
          padding: 16, 
          font: { size: 12 } 
        },
      },
    },
  };

  return (
    <div>
      <PageHeader 
        title="Analytics" 
        subtitle="Track your startup's performance metrics" 
      />

      {/* Key Metrics Grid */}
      <div className="grid" style={{ marginBottom: '1.5rem' }}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.5rem' }}>
              {analytics.validationScore || 0}%
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Overall Score
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--success)', marginBottom: '0.5rem' }}>
              {analytics.overallProgress || 0}%
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Journey Progress
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--info)', marginBottom: '0.5rem' }}>
              {tasksData.completed}/{tasksData.total}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Growth Tasks
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Stage Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stage Performance</CardTitle>
          </CardHeader>
          <div style={{ height: '300px', padding: '1rem' }}>
            {stageData.labels && stageData.labels.length > 0 ? (
              <Radar data={radarData} options={radarOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                No stage data available
              </div>
            )}
          </div>
        </Card>

        {/* Task Completion Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Task Completion</CardTitle>
          </CardHeader>
          <div style={{ height: '300px', padding: '1rem' }}>
            {tasksData.total > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                No task data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Summary</CardTitle>
        </CardHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Validation Score', value: `${analytics.validationScore || 0}%` },
            { label: 'Stages Validated', value: `${analytics.validationProgress?.completed || 0}/5` },
            { label: 'Tasks Completed', value: `${tasksData.completed}/${tasksData.total}` },
            { label: 'Reward Points', value: user?.rewardPoints ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '1rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
