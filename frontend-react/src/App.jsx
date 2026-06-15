import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import AppUpdateBanner from './components/shared/AppUpdateBanner';
import OnboardingTutorial from './components/shared/OnboardingTutorial';
import FloatingSupportButton from './components/shared/FloatingSupportButton';
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

  // Show spinner only during initial bootstrap (no stored credentials).
  // If we have stored credentials (isAuthenticated=true) don't block navigation
  // even if loading=true — the background profile refresh will correct any issues.
  if (loading && !isAuthenticated) return <LoadingScreen />;

  // Not logged in
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Correct role but user obj not loaded yet — wait briefly
  if (!user) return <LoadingScreen />;

  // Wrong role — redirect to correct dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
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

  // Only block on loading if we don't have any auth state yet.
  // If user has stored credentials, redirect immediately.
  if (loading && !isAuthenticated) return <LoadingScreen />;

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

// Create React Query client with production-tuned defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus — prevents a burst of requests every time
      // the user alt-tabs back. Components that need fresh data can set their own.
      refetchOnWindowFocus: false,

      // Retry once on failure with exponential backoff to avoid hammering a
      // flaky endpoint repeatedly (e.g., temporary Railway cold-start).
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),

      // Data is considered fresh for 2 minutes. During this window, navigating
      // back to a page that already fetched shows instant data with no spinner.
      staleTime: 2 * 60 * 1000,

      // Keep unused cached data for 5 minutes before garbage collection.
      // Prevents re-fetching when the user navigates away and returns quickly.
      gcTime: 5 * 60 * 1000,

      // Return cached data immediately while revalidating in the background
      // (stale-while-revalidate). Users see data instantly on repeat visits.
      placeholderData: (prev) => prev,
    },
    mutations: {
      // Don't retry mutations — they have side effects and retrying silently
      // can cause duplicate actions (e.g., double-sending a request).
      retry: false,
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
          <FloatingSupportButton />
          <OnboardingTutorial />
          <AppUpdateBanner />
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
