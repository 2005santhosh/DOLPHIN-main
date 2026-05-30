import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import Modal from '../../shared/Modal';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { authAPI, verificationAPI } from '../../../services/api';
import LegalSections from '../../shared/LegalSections';
import VerificationModal from '../../shared/VerificationModal';
import VerifiedBadge from '../../shared/VerifiedBadge';
import { Eye, EyeOff, AlertTriangle } from '../../shared/Icons';
import { buildUIVerificationState } from '../../../utils/verificationHelpers';

const SettingsPage = () => {
  const { user, logout, refreshProfile } = useAuth();

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    profilePicture: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: ''
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null);   // null = loading
  const [verifyLoading, setVerifyLoading] = useState(true);

  // Single source of truth for UI — uses API response when loaded, user object as fallback
  const vs = buildUIVerificationState(verifyStatus, user);

  useEffect(() => {
    loadSettings();
    loadVerifyStatus();

    // Handle return from Cashfree checkout
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const orderStatus = params.get('order_status');

    if (orderId || orderStatus) {
      // Clean URL immediately
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);

      if (orderStatus === 'FAILED' || orderStatus === 'CANCELLED') {
        toast.error('Payment was not completed. Please try again.');
      } else if (orderId) {
        // Call refresh-status to actively check Cashfree and activate badge
        toast.loading('Verifying your payment…', { id: 'verify-toast' });
        refreshPaymentStatus(orderId);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPaymentStatus = async (orderId) => {
    // Try refresh-status first (actively checks Cashfree)
    let activated = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const { verificationAPI: vAPI } = await import('../../../services/api');
        const s = await vAPI.refreshStatus(orderId);
        if (s.isVerified) {
          activated = true;
          setVerifyStatus({ ...s, daysLeft: s.verifiedUntil ? Math.max(0, Math.ceil((new Date(s.verifiedUntil) - new Date()) / 86400000)) : null });
          if (refreshProfile) refreshProfile().catch(() => {});
          toast.success('🎉 Your profile is now Verified!', { id: 'verify-toast' });
          break;
        }
        if (s.orderStatus === 'FAILED' || s.orderStatus === 'CANCELLED') {
          toast.error('Payment failed. Please try again.', { id: 'verify-toast' });
          break;
        }
      } catch {}
      // Wait 4s between attempts
      await new Promise(r => setTimeout(r, 4000));
    }
    if (!activated) {
      toast.dismiss('verify-toast');
      // Fall back to polling /status
      startPolling();
    }
  };

  const startPolling = () => {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const { verificationAPI: vAPI } = await import('../../../services/api');
        const s = await vAPI.getStatus();
        if (s.isVerified) {
          clearInterval(poll);
          setVerifyStatus(s);
          if (refreshProfile) refreshProfile().catch(() => {});
          toast.success('🎉 Your profile is now Verified!');
        }
      } catch {}
      if (attempts >= 10) clearInterval(poll);
    }, 5000);
  };

  const loadVerifyStatus = async () => {
    setVerifyLoading(true);
    try {
      const s = await verificationAPI.getStatus();
      setVerifyStatus(s);
    } catch {
      // On error, keep using user object fallback — don't block UI
    } finally {
      setVerifyLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const profile = await authAPI.getProfile();
      setProfileData({
        name: profile.name || '',
        email: profile.email || '',
        profilePicture: profile.profilePicture || ''
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!profileData.name.trim()) { toast.error('Name cannot be empty'); return; }
    try {
      await authAPI.updateProfile(profileData.name);
      if (refreshProfile) await refreshProfile().catch(() => {});
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) { toast.error('Please select a JPG or PNG image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size exceeds 5MB limit.'); return; }

    const formData = new FormData();
    formData.append('profilePicture', file);
    setUploading(true);
    try {
      const result = await authAPI.uploadProfilePicture(formData);
      const newUrl = result.profilePicture || result.url || '';
      setProfileData(prev => ({ ...prev, profilePicture: newUrl }));
      if (refreshProfile) await refreshProfile().catch(() => {});
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) { toast.error('Fill all password fields'); return; }
    if (passwordData.newPassword.length < 8) { toast.error('Password must be 8+ characters'); return; }
    try {
      await authAPI.updatePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success('Password Updated!');
      setPasswordData({ currentPassword: '', newPassword: '' });
    } catch (error) {
      toast.error(error.message || 'Failed to update password');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error("Please type 'DELETE' to confirm.");
      return;
    }

    try {
      await authAPI.deleteAccount();
      toast.success('✅ Your account has been deleted successfully.');
      localStorage.clear();
      window.location.href = '/';
    } catch (error) {
      toast.error(error.message || 'Failed to delete account');
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getProfileImageUrl = () => {
    if (profileData.profilePicture) {
      return profileData.profilePicture.startsWith('http')
        ? profileData.profilePicture
        : `${window.location.origin}${profileData.profilePicture}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name || 'User')}&background=0a0a0a&color=D4FF00&size=100`;
  };

  return (
    <div>
      <PageHeader 
        title="Settings" 
        subtitle="Manage your account and preferences" 
      />

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <input
            type="file"
            id="profile-picture-input"
            accept="image/jpeg, image/png"
            style={{ display: 'none' }}
            onChange={handleProfilePictureUpload}
          />

          <div
            className={`profile-edit-container ${uploading ? 'uploading' : ''}`}
            onClick={() => document.getElementById('profile-picture-input').click()}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <img
              src={getProfileImageUrl()}
              alt="Profile"
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '50%',
                border: '2px solid var(--border-color)'
              }}
            />
            {uploading && (
              <div className="upload-spinner" style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '30px',
                height: '30px',
                border: '3px solid rgba(212,255,0,0.2)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.25rem 0' }}>Profile Picture</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Click image to upload JPG or PNG (Max 5MB).
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileUpdate}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={profileData.name}
              onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={profileData.email}
              readOnly
              style={{ background: 'rgba(255,255,255,0.02)' }}
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Update Profile
          </button>
        </form>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>

        <form onSubmit={handlePasswordUpdate}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword.current ? 'text' : 'password'}
                className="form-input"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('current')}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword.new ? 'text' : 'password'}
                className="form-input"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('new')}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            Update Password
          </button>
        </form>
      </Card>

      {/* ── Verified Badge ── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <VerifiedBadge size={20} /> Profile Verification
          </CardTitle>
        </CardHeader>

        {verifyLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F3F4F6', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, background: '#F3F4F6', borderRadius: 6, width: '60%', marginBottom: 8 }} />
              <div style={{ height: 12, background: '#F3F4F6', borderRadius: 6, width: '80%' }} />
            </div>
          </div>

        ) : vs.isFounderVerified ? (
          /* Case A: Founder-lifetime verified */
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.25rem' }}>🏆</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <VerifiedBadge size={16} /> Early Supporter — Lifetime Verified Badge
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
                You have a lifetime verified badge as an early supporter. Thank you for helping build the Dolphin ecosystem.
              </div>
            </div>
          </div>

        ) : vs.isAdminVerified ? (
          /* Case B: Admin/manual verified */
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <VerifiedBadge size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <VerifiedBadge size={16} /> Profile Verified
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
                Congratulations, your profile is already verified. Thank you for being part of this ecosystem.
              </div>
            </div>
          </div>

        ) : vs.isVerified ? (
          /* Case C: Active paid verification */
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.5rem 0', marginBottom: '1rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #84CC16, #16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polyline points="7 12 10.5 15.5 17 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <VerifiedBadge size={16} /> Profile Verified
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 4, lineHeight: 1.6 }}>
                  Congratulations, your profile is already verified. Thank you for being part of this ecosystem.
                </div>
                {vs.verifiedUntil && (
                  <div style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: 4 }}>
                    Valid until: <strong>{new Date(vs.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    {vs.daysLeft !== null && ` (${vs.daysLeft} day${vs.daysLeft !== 1 ? 's' : ''} left)`}
                  </div>
                )}
                {vs.daysLeft !== null && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ height: 4, background: '#E5E7EB', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 9999, background: vs.daysLeft <= 5 ? '#EF4444' : vs.daysLeft <= 10 ? '#F59E0B' : '#84CC16', width: `${Math.min(100, (vs.daysLeft / 30) * 100)}%`, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: 2 }}>{vs.daysLeft} / 30 days remaining</div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setVerifyModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', color: '#16A34A', border: '1.5px solid #84CC16', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              ↻ Renew Badge – ₹99
            </button>
          </div>

        ) : vs.shouldShowPending ? (
          /* Case D: Pending payment */
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
            <span style={{ fontSize: '1.5rem' }}>⏳</span>
            <div>
              <div style={{ fontWeight: 600, color: '#92400E', fontSize: '0.9rem' }}>Payment Pending</div>
              <div style={{ fontSize: '0.82rem', color: '#92400E', marginTop: 2 }}>
                Payment pending — your verified badge will activate once payment is confirmed.
              </div>
            </div>
          </div>

        ) : (
          /* Case E: Not verified / expired */
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: 1.6 }}>
              Get a verified badge on your profile for <strong>₹99/month</strong>. Stand out in the Dolphin ecosystem
              with boosted visibility, higher connection chances, and a trust badge.
            </p>
            <button onClick={() => setVerifyModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg, #84CC16, #16A34A)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(132,204,22,0.3)' }}>
              <VerifiedBadge size={16} /> Get Verified – ₹99/month
            </button>
          </div>
        )}
      </Card>

      {/* Legal & Support — open in new tab */}
      <Card>
        <CardHeader>
          <CardTitle>Legal & Support</CardTitle>
        </CardHeader>
        <LegalSections />
      </Card>

      {/* Danger Zone */}
      <Card className="danger-zone-card" style={{ border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.03)' }}>
        <div className="card-header" style={{ background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid rgba(248,113,113,0.12)' }}>
        <CardTitle style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} /> Danger Zone
          </CardTitle>
          <p style={{ fontSize: '0.85rem', color: 'var(--error)', margin: 0 }}>Irreversible and critical actions</p>
        </div>
        <div style={{ padding: '0 24px' }}>
          <div className="danger-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Logout</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Sign out of your current session.</div>
            </div>
            <button className="btn btn-secondary" onClick={logout}>Logout</button>
          </div>
          <div className="danger-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Delete Account</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Permanently delete your account and all associated data. This action cannot be undone.</div>
            </div>
            <button className="btn btn-danger" onClick={() => setDeleteModalOpen(true)}>Delete Account</button>
          </div>
        </div>
      </Card>

      {/* Verification Modal */}
      <VerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        userName={user?.name || ''}
        userEmail={user?.email || ''}
        onPaymentComplete={(orderId) => {
          setVerifyModalOpen(false);
          if (orderId) {
            toast.loading('Verifying your payment…', { id: 'verify-toast' });
            refreshPaymentStatus(orderId);
          } else {
            startPolling();
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="⚠️ Delete Account"
        maxWidth="450px"
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            This action is irreversible. All your data will be permanently removed.
          </p>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            Please type <span style={{ color: 'var(--error)' }}>DELETE</span> to confirm:
          </p>
          <input
            type="text"
            className="form-input"
            placeholder="Type DELETE..."
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            style={{ marginBottom: '1rem', textAlign: 'center' }}
          />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteAccount}>
              Delete Forever
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
