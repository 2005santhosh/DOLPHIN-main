import React from 'react';

const StatCard = ({ value, label, index = 0 }) => {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid var(--${index === 0 ? 'primary' : index === 1 ? 'success' : 'warning'})` }}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

export default StatCard;
