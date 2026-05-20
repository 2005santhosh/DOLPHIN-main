import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import Header from '../shared/Header';
import toast from 'react-hot-toast';
import Modal from '../shared/Modal';
import LegalSections from '../shared/LegalSections';
import {
  BarChart2, Users, Rocket, Puzzle, Bell, Settings,
  Clock, CheckCircle2, Eye, ShieldAlert, Star,
} from '../shared/Icons';

// ─── helpers ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function adminFetch(path, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const getStatusClass = (state) => {
  if (state === 'PENDING_APPROVAL') return { bg: '#FEF3C7', color: '#92400E', label: 'Pending' };
  if (state === 'BLOCKED') return { bg: '#FEE2E2', color: '#991B1B', label: 'Blocked' };
  return { bg: '#D1FAE5', color: '#065F46', label: state?.startsWith('STAGE_') ? state.replace('_', ' ') : 'Active' };
};

const StatusBadge = ({ state }) => {
  const s = getStatusClass(state);
  return <span style={{ padding: '3px 10px', background: s.bg, color: s.color, borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>;
};

const RoleBadge = ({ role }) => {
  const map = { founder: '#DBEAFE/#1D4ED8', investor: '#F5F3FF/#6D28D9', provider: '#D1FAE5/#065F46', admin: '#FEE2E2/#991B1B' };
  const [bg, color] = (map[role] || '#F3F4F6/#374151').split('/');
  return <span style={{ padding: '3px 10px', background: bg, color, borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{role}</span>;
};

const StatCard = ({ icon, value, label, color = '#3B82F6', bg = '#DBEAFE' }) => (
  <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #E5E7EB', display: 'flex', gap: '1rem', alignItems: 'center' }}>
    <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

// ─── Sidebar nav items ─────────────────────────────────────────────────────────
const NAV = [
  { key: 'dashboard',     label: 'Dashboard',           icon: <BarChart2 size={18} /> },
  { key: 'users',         label: 'Users',               icon: <Users size={18} /> },
  { key: 'startups',      label: 'Startups',            icon: <Rocket size={18} /> },
  { key: 'providers',     label: 'Providers',           icon: <Puzzle size={18} /> },
  { key: 'notifications', label: 'Send Notifications',  icon: <Bell size={18} /> },
  { key: 'settings',      label: 'Settings',            icon: <Settings size={18} /> },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header onMenuToggle={() => setSidebarOpen(v => !v)} />

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <nav style={{
          width: 240, background: 'white', borderRight: '1px solid #E5E7EB',
          display: 'flex', flexDirection: 'column', padding: '1rem 0',
          position: 'sticky', top: 73, height: 'calc(100vh - 73px)', overflowY: 'auto',
        }}>
          <div style={{ padding: '0 0.75rem', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '0 0.75rem' }}>Navigation</p>
          </div>
          {NAV.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setPage(key)} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.625rem 1.5rem', background: page === key ? '#F0FDF4' : 'transparent',
              border: 'none', borderLeft: page === key ? '3px solid #84CC16' : '3px solid transparent',
              color: page === key ? '#166534' : '#374151', fontWeight: page === key ? 600 : 400,
              cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', width: '100%',
              transition: 'all 0.15s',
            }}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main style={{ flex: 1, padding: '2rem', minWidth: 0 }}>
          {page === 'dashboard'     && <DashboardPage />}
          {page === 'users'         && <UsersPage />}
          {page === 'startups'      && <StartupsPage />}
          {page === 'providers'     && <ProvidersPage />}
          {page === 'notifications' && <NotificationsPage />}
          {page === 'settings'      && <AdminSettingsPage />}
        </main>
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, pending] = await Promise.all([
        adminFetch('/admin/dashboard'),
        adminFetch('/admin/pending-users'),
      ]);
      setStats(dash);
      setRecent(pending.slice(0, 5));
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Loading dashboard…</div>;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Admin Dashboard</h1>
        <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Platform overview and quick actions</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={<Users size={24} color="#3B82F6" />}     value={stats?.users?.total ?? 0}       label="Total Users"         color="#3B82F6" bg="#DBEAFE" />
        <StatCard icon={<Clock size={24} color="#F59E0B" />}     value={stats?.users?.pending ?? 0}     label="Pending Approvals"   color="#F59E0B" bg="#FEF3C7" />
        <StatCard icon={<Rocket size={24} color="#10B981" />}    value={stats?.startups?.validated ?? 0} label="Validated Startups" color="#10B981" bg="#D1FAE5" />
        <StatCard icon={<Puzzle size={24} color="#6366F1" />}    value={stats?.providers?.verified ?? 0} label="Active Providers"   color="#6366F1" bg="#E0E7FF" />
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent Registrations</h3>
          <button onClick={load} className="btn btn-secondary btn-sm">↻ Refresh</button>
        </div>
        {recent.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '1.5rem' }}>No pending users</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recent.map(u => (
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#F9FAFB', borderRadius: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{u.name}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>{u.email} · {timeAgo(u.createdAt)}</p>
                </div>
                <RoleBadge role={u.role} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Page ────────────────────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailUser, setDetailUser] = useState(null);
  const [busy, setBusy] = useState({});

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let list = users;
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter(u => u.state === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [users, search, roleFilter, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const action = async (fn, label) => {
    try {
      const res = await fn();
      toast.success(res.message || `${label} successful`);
      load();
    } catch (err) { toast.error(err.message || `${label} failed`); }
  };

  const approve = (id) => { setBusy(p => ({ ...p, [id]: true })); action(() => adminFetch('/admin/approve-user', 'POST', { userId: id }), 'Approved').finally(() => setBusy(p => ({ ...p, [id]: false }))); };
  const reject  = (id) => { if (!confirm('Reject this user?')) return; setBusy(p => ({ ...p, [id]: true })); action(() => adminFetch('/admin/reject-user', 'POST', { userId: id }), 'Rejected').finally(() => setBusy(p => ({ ...p, [id]: false }))); };
  const block   = (id) => { if (!confirm('Block this user?')) return; setBusy(p => ({ ...p, [id]: true })); action(() => adminFetch('/admin/block-user', 'POST', { userId: id }), 'Blocked').finally(() => setBusy(p => ({ ...p, [id]: false }))); };
  const advance = (id) => { if (!confirm('Advance this user to next stage?')) return; setBusy(p => ({ ...p, [id]: true })); action(() => adminFetch('/admin/move-stage', 'POST', { userId: id }), 'Advanced').finally(() => setBusy(p => ({ ...p, [id]: false }))); };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>User Management</h1>
        <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Manage all platform users</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input className="form-input" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 200px' }} />
        <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ flex: '0 1 140px' }}>
          <option value="all">All Roles</option>
          <option value="founder">Founders</option>
          <option value="investor">Investors</option>
          <option value="provider">Providers</option>
          <option value="admin">Admins</option>
        </select>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '0 1 140px' }}>
          <option value="all">All Status</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="STAGE_1">Active</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Loading users…</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['User', 'Email', 'Role', 'Status', 'Stage', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>No users found</td></tr>
                ) : filtered.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, color: '#111827' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem 1rem' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '0.75rem 1rem' }}><StatusBadge state={u.state} /></td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>Stage {u.stage || 0}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {u.state === 'PENDING_APPROVAL' && (
                          <>
                            <button className="btn btn-primary btn-sm" disabled={busy[u._id]} onClick={() => approve(u._id)} style={{ padding: '3px 10px', fontSize: '0.75rem' }}>✓ Approve</button>
                            <button className="btn btn-secondary btn-sm" disabled={busy[u._id]} onClick={() => reject(u._id)} style={{ padding: '3px 10px', fontSize: '0.75rem', color: '#DC2626' }}>✕ Reject</button>
                          </>
                        )}
                        {u.state !== 'BLOCKED' && u.state !== 'PENDING_APPROVAL' && (
                          <button className="btn btn-secondary btn-sm" disabled={busy[u._id]} onClick={() => advance(u._id)} style={{ padding: '3px 10px', fontSize: '0.75rem' }}>→ Advance</button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetailUser(u)} style={{ padding: '3px 10px', fontSize: '0.75rem' }}>View</button>
                        {u.state !== 'BLOCKED' && (
                          <button className="btn btn-secondary btn-sm" disabled={busy[u._id]} onClick={() => block(u._id)} style={{ padding: '3px 10px', fontSize: '0.75rem', color: '#DC2626' }}>Block</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      <Modal isOpen={!!detailUser} onClose={() => setDetailUser(null)} title="User Details" maxWidth="480px">
        {detailUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              ['Name', detailUser.name],
              ['Email', detailUser.email],
              ['Role', <RoleBadge role={detailUser.role} />],
              ['Status', <StatusBadge state={detailUser.state} />],
              ['Stage', `Stage ${detailUser.stage || 0}`],
              ['Joined', fmtDate(detailUser.createdAt)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>{label}</span>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Startups Page ─────────────────────────────────────────────────────────────
function StartupsPage() {
  const [startups, setStartups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { adminFetch('/admin/startups').then(d => setStartups(Array.isArray(d) ? d : [])).catch(() => toast.error('Failed')).finally(() => setLoading(false)); }, []);

  const filtered = startups.filter(s =>
    !search.trim() ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.founderId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Startup Management</h1>
        <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Monitor all startups on the platform</p>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <input className="form-input" placeholder="Search startups or founders…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Loading…</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Startup', 'Founder', 'Industry', 'Stage', 'Validation Score', 'Status'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>No startups found</td></tr>
                ) : filtered.map(s => (
                  <tr key={s._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#111827' }}>{s.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{s.founderId?.name || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{s.industry || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>Stage {s.currentStage || 0}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 80, height: 6, background: '#E5E7EB', borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${s.validationScore || 0}%`, height: '100%', background: s.validationScore >= 70 ? '#10B981' : '#F59E0B', borderRadius: 9999 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: s.validationScore >= 70 ? '#059669' : '#D97706' }}>{s.validationScore || 0}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '3px 10px', background: s.validationScore >= 70 ? '#D1FAE5' : '#FEF3C7', color: s.validationScore >= 70 ? '#065F46' : '#92400E', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600 }}>
                        {s.validationScore >= 70 ? 'Validated' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Providers Page ────────────────────────────────────────────────────────────
function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const load = () => {
    setLoading(true);
    adminFetch('/admin/providers').then(d => setProviders(Array.isArray(d) ? d : [])).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const verify = async (id) => {
    if (!confirm('Verify this provider?')) return;
    setBusy(p => ({ ...p, [id]: true }));
    try {
      const res = await adminFetch('/admin/verify-provider', 'POST', { providerId: id });
      toast.success(res.message || 'Provider verified');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  const reject = async (id) => {
    if (!confirm('Reject and remove this provider?')) return;
    setBusy(p => ({ ...p, [id]: true }));
    try {
      const res = await adminFetch('/admin/reject-provider', 'POST', { providerId: id });
      toast.success(res.message || 'Provider rejected');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Provider Management</h1>
        <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Verify and manage service providers</p>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Loading…</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Provider', 'Email', 'Category', 'Experience', 'Status', 'Rating', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>No providers found</td></tr>
                ) : providers.map(p => (
                  <tr key={p._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#111827' }}>{p.name || p.userId?.name || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{p.userId?.email || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{p.category || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{p.experienceLevel || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '3px 10px', background: p.verified ? '#D1FAE5' : '#FEF3C7', color: p.verified ? '#065F46' : '#92400E', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600 }}>
                        {p.verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{p.rating ? `${Number(p.rating).toFixed(1)} ★` : 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {!p.verified && (
                          <>
                            <button className="btn btn-primary btn-sm" disabled={busy[p._id]} onClick={() => verify(p._id)} style={{ padding: '3px 10px', fontSize: '0.75rem' }}>✓ Verify</button>
                            <button className="btn btn-secondary btn-sm" disabled={busy[p._id]} onClick={() => reject(p._id)} style={{ padding: '3px 10px', fontSize: '0.75rem', color: '#DC2626' }}>✕ Reject</button>
                          </>
                        )}
                        {p.verified && <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>✓ Verified</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notifications Page ────────────────────────────────────────────────────────
function NotificationsPage() {
  const [tab, setTab] = useState('role');
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // Role form
  const [roleForm, setRoleForm] = useState({ role: '', title: '', message: '', priority: 'high' });
  // Broadcast form
  const [bcForm, setBcForm] = useState({ title: '', message: '', priority: 'medium' });
  // Users form
  const [usersForm, setUsersForm] = useState({ title: '', message: '', priority: 'high' });

  useEffect(() => {
    adminFetch('/admin/users').then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const sendByRole = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await adminFetch('/admin/admin-notifications/send-by-role', 'POST', roleForm);
      toast.success(res.message || 'Sent!');
      setRoleForm({ role: '', title: '', message: '', priority: 'high' });
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setSending(false); }
  };

  const broadcast = async (e) => {
    e.preventDefault();
    if (!confirm('Send to ALL users?')) return;
    setSending(true);
    try {
      const res = await adminFetch('/admin/admin-notifications/send-to-all', 'POST', bcForm);
      toast.success(res.message || 'Broadcast sent!');
      setBcForm({ title: '', message: '', priority: 'medium' });
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setSending(false); }
  };

  const sendToUsers = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) { toast.error('Select at least one user'); return; }
    setSending(true);
    try {
      const res = await adminFetch('/admin/admin-notifications/send-to-users', 'POST', { ...usersForm, userIds: selectedIds });
      toast.success(res.message || 'Sent!');
      setUsersForm({ title: '', message: '', priority: 'high' });
      setSelectedIds([]);
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setSending(false); }
  };

  const toggleUser = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredUsers = users.filter(u => !userSearch.trim() || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()));

  const tabStyle = (t) => ({
    padding: '0.625rem 1.25rem', background: 'transparent', border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary, #84CC16)' : '2px solid transparent',
    color: tab === t ? 'var(--primary, #84CC16)' : '#6B7280',
    fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontSize: '0.9rem',
  });

  const formCard = (title, onSubmit, children) => (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
      <form onSubmit={onSubmit}>{children}</form>
    </div>
  );

  const prioritySelect = (val, onChange) => (
    <div className="form-group">
      <label className="form-label">Priority</label>
      <select className="form-select" value={val} onChange={e => onChange(e.target.value)}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Send Notifications</h1>
        <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Send real-time notifications to users</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB', marginBottom: '1.5rem' }}>
        <button style={tabStyle('role')} onClick={() => setTab('role')}>📢 By Role</button>
        <button style={tabStyle('broadcast')} onClick={() => setTab('broadcast')}>🌐 Broadcast</button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}>👥 Specific Users</button>
      </div>

      {tab === 'role' && formCard('Send by Role', sendByRole, (
        <>
          <div className="form-group">
            <label className="form-label">Target Role *</label>
            <select className="form-select" value={roleForm.role} onChange={e => setRoleForm(p => ({ ...p, role: e.target.value }))} required>
              <option value="">Select role…</option>
              <option value="founder">All Founders</option>
              <option value="investor">All Investors</option>
              <option value="provider">All Providers</option>
              <option value="admin">All Admins</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={roleForm.title} onChange={e => setRoleForm(p => ({ ...p, title: e.target.value }))} placeholder="Notification title" required />
          </div>
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-textarea" value={roleForm.message} onChange={e => setRoleForm(p => ({ ...p, message: e.target.value }))} placeholder="Notification message" required rows={3} />
          </div>
          {prioritySelect(roleForm.priority, v => setRoleForm(p => ({ ...p, priority: v })))}
          <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send to Role'}</button>
        </>
      ))}

      {tab === 'broadcast' && formCard('Broadcast to All Users', broadcast, (
        <>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={bcForm.title} onChange={e => setBcForm(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" required />
          </div>
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-textarea" value={bcForm.message} onChange={e => setBcForm(p => ({ ...p, message: e.target.value }))} placeholder="Broadcast message" required rows={3} />
          </div>
          {prioritySelect(bcForm.priority, v => setBcForm(p => ({ ...p, priority: v })))}
          <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Broadcast to All'}</button>
        </>
      ))}

      {tab === 'users' && formCard('Send to Specific Users', sendToUsers, (
        <>
          <div className="form-group">
            <label className="form-label">Select Users ({selectedIds.length} selected)</label>
            <input className="form-input" placeholder="Search users…" value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ marginBottom: '0.5rem' }} />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
              {filteredUsers.map(u => (
                <div key={u._id} onClick={() => toggleUser(u._id)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem',
                  cursor: 'pointer', background: selectedIds.includes(u._id) ? '#F0FDF4' : 'transparent',
                  borderBottom: '1px solid #F3F4F6',
                }}>
                  <input type="checkbox" readOnly checked={selectedIds.includes(u._id)} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>{u.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={usersForm.title} onChange={e => setUsersForm(p => ({ ...p, title: e.target.value }))} placeholder="Notification title" required />
          </div>
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-textarea" value={usersForm.message} onChange={e => setUsersForm(p => ({ ...p, message: e.target.value }))} placeholder="Notification message" required rows={3} />
          </div>
          {prioritySelect(usersForm.priority, v => setUsersForm(p => ({ ...p, priority: v })))}
          <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send to Selected'}</button>
        </>
      ))}
    </div>
  );
}

// ─── Admin Settings Page ───────────────────────────────────────────────────────
function AdminSettingsPage() {
  const { user, logout, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const updateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await adminFetch('/auth/profile', 'PUT', { name });
      if (refreshProfile) await refreshProfile().catch(() => {});
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Settings</h1>
        <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '0.9rem' }}>Manage your admin account</p>
      </div>

      {/* Account */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700 }}>Account Settings</h3>
        <form onSubmit={updateProfile}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" value={user?.email || ''} readOnly style={{ background: '#F9FAFB' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <input className="form-input" value="Admin" readOnly style={{ background: '#F9FAFB' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Update Profile'}</button>
        </form>
      </div>

      {/* Legal & Support */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700 }}>Legal & Support</h3>
        <LegalSections />
      </div>

      {/* Danger Zone */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #FECACA', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#DC2626' }}>⚠️ Danger Zone</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>Logout</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>Sign out of your current session.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => logout()}>Logout</button>
        </div>
      </div>
    </div>
  );
}
