import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F9FAFB',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: '6rem',
          fontWeight: '800',
          color: '#3B82F6',
          marginBottom: '1rem',
        }}>
          404
        </h1>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '1rem',
        }}>
          Page Not Found
        </h2>
        <p style={{
          color: '#6B7280',
          marginBottom: '2rem',
        }}>
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="btn btn-primary"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
