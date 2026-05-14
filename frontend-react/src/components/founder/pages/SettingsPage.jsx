import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import Modal from '../../shared/Modal';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { authAPI } from '../../../services/api';
import LegalSections from '../../shared/LegalSections';

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

  useEffect(() => {
    loadSettings();
  }, []);

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
      toast.success('✅ Profile picture updated!');
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
              >
                {showPassword.current ? '👁️' : '👁️‍🗨️'}
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
              >
                {showPassword.new ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            Update Password
          </button>
        </form>
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
          <CardTitle style={{ color: 'var(--error)' }}>⚠️ Danger Zone</CardTitle>
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
