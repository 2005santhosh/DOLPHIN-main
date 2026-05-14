import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
      <div style={{
        display: 'inline-block',
        width: '50px',
        height: '50px',
        border: '5px solid var(--bg-surface-2)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <p style={{ marginTop: '1rem' }}>{message}</p>
    </div>
  );
};

export default LoadingSpinner;
