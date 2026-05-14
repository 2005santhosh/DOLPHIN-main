import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import './styles/GlobalStyles.css';
import './styles/components.css';
import './styles/mobile.css';

// Auth Pages
const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));

// Dashboard Pages
const FounderDashboard = lazy(() => import('./components/founder/FounderDashboard'));
const InvestorDashboard = lazy(() => import('./components/investor/InvestorDashboard'));
const ProviderDashboard = lazy(() => import('./components/provider/ProviderDashboard'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

// Shared Pages
const Landing = lazy(() => import('./components/shared/Landing'));
const NotFound = lazy(() => import('./components/shared/NotFound'));

// Legal Pages
const PrivacyPolicy  = lazy(() => import('./components/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService'));
const RefundPolicy   = lazy(() => import('./components/legal/RefundPolicy'));
const SupportPage    = lazy(() => import('./components/legal/SupportPage'));

// Loading Component
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#F9FAFB'
  }}>
    <div style={{
      textAlign: 'center'
    }}>
      <div className="spinner" style={{
        width: '3rem',
        height: '3rem',
        margin: '0 auto 1rem'
      }}></div>
      <p style={{ color: '#6B7280' }}>Loading...</p>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Still initialising — show spinner
  if (loading) return <LoadingScreen />;

  // Not logged in
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Wrong role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const routes = {
      founder: '/dashboard',
      investor: '/investor-dashboard',
      provider: '/provider-dashboard',
      admin: '/admin-dashboard',
    };
    return <Navigate to={routes[user.role] || '/'} replace />;
  }

  return children;
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (isAuthenticated && user) {
    const routes = {
      founder:  '/dashboard',
      investor: '/investor-dashboard',
      provider: '/provider-dashboard',
      admin:    '/admin-dashboard',
    };
    return <Navigate to={routes[user.role] || '/'} replace />;
  }

  return children;
};

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/login.html"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/register.html"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-password.html" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password.html" element={<ResetPassword />} />

        {/* Legal Pages — public, open in new tab */}
        <Route path="/privacy"       element={<PrivacyPolicy />} />
        <Route path="/terms"         element={<TermsOfService />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/support"       element={<SupportPage />} />

        {/* Protected Routes - Founder */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['founder']}>
              <FounderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard.html"
          element={
            <ProtectedRoute allowedRoles={['founder']}>
              <FounderDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - Investor */}
        <Route
          path="/investor-dashboard"
          element={
            <ProtectedRoute allowedRoles={['investor']}>
              <InvestorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investor-dashboard.html"
          element={
            <ProtectedRoute allowedRoles={['investor']}>
              <InvestorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - Provider */}
        <Route
          path="/provider-dashboard"
          element={
            <ProtectedRoute allowedRoles={['provider']}>
              <ProviderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider-dashboard.html"
          element={
            <ProtectedRoute allowedRoles={['provider']}>
              <ProviderDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - Admin */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'investor']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard.html"
          element={
            <ProtectedRoute allowedRoles={['admin', 'investor']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#FFFFFF',
                color: '#0F172A',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                border: '1px solid #E2E8F0',
                fontSize: '0.9375rem',
                fontWeight: '600',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#FFFFFF',
                },
                style: {
                  background: '#D1FAE5',
                  color: '#10B981',
                  borderColor: '#10B981',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#FFFFFF',
                },
                style: {
                  background: '#FEE2E2',
                  color: '#EF4444',
                  borderColor: '#EF4444',
                },
              },
            }}
          />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
