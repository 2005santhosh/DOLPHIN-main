import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { providerAPI } from '../../../services/api';

const EMPTY_FORM = {
  name: '',
  category: '',
  experienceLevel: 'mid',
  specialties: '',
  bio: '',
  description: '',
  availability: 'medium',
  contactMethod: 'email',
};

const ProfilePage = () => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profile = await providerAPI.getMyProfile();
      setFormData({
        name:            profile.name            || '',
        category:        profile.category        || '',
        experienceLevel: profile.experienceLevel || 'mid',
        specialties:     Array.isArray(profile.specialties)
                           ? profile.specialties.join(', ')
                           : (profile.specialties || ''),
        bio:             profile.bio             || '',
        description:     profile.description     || '',
        availability:    profile.availability    || 'medium',
        contactMethod:   profile.contactMethod   || 'email',
      });
    } catch (error) {
      if (error?.status !== 404) {
        toast.error('Failed to load profile');
      }
      // 404 = profile not yet created — form stays empty, user can fill and save
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const specialtiesArray = formData.specialties
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await providerAPI.updateMyProfile({
        name:            formData.name.trim(),
        category:        formData.category.trim(),
        description:     formData.description.trim() || formData.bio.trim(),
        bio:             formData.bio.trim(),
        experienceLevel: formData.experienceLevel,
        specialties:     specialtiesArray,
        availability:    formData.availability,
        contactMethod:   formData.contactMethod,
      });

      toast.success('Profile updated successfully!');
      loadProfile();
    } catch (error) {
      toast.error(error?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading profile..." />;

  return (
    <div>
      <PageHeader
        title="Provider Profile"
        subtitle="Manage your professional information visible to founders"
      />

      <Card>
        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-name">Full Name *</label>
            <input
              id="p-name"
              type="text"
              className="form-input"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your full name"
              required
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-category">Service Category</label>
            <input
              id="p-category"
              type="text"
              className="form-input"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="e.g., Legal, Tech, Marketing, Finance"
            />
          </div>

          {/* Experience Level */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-experienceLevel">Experience Level</label>
            <select
              id="p-experienceLevel"
              className="form-select"
              name="experienceLevel"
              value={formData.experienceLevel}
              onChange={handleChange}
            >
              <option value="junior">Junior (0–2 years)</option>
              <option value="mid">Mid-level (2–5 years)</option>
              <option value="senior">Senior (5–10 years)</option>
              <option value="executive">Executive (10+ years)</option>
            </select>
          </div>

          {/* Specialties */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-specialties">Specialties</label>
            <input
              id="p-specialties"
              type="text"
              className="form-input"
              name="specialties"
              value={formData.specialties}
              onChange={handleChange}
              placeholder="e.g., React, Node.js, UI/UX (comma-separated)"
            />
            <small style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              Separate multiple specialties with commas
            </small>
          </div>

          {/* Bio */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-bio">Bio</label>
            <textarea
              id="p-bio"
              className="form-textarea"
              name="bio"
              rows="3"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Short bio about yourself..."
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-description">Description / Services Offered</label>
            <textarea
              id="p-description"
              className="form-textarea"
              name="description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the services you offer to startups..."
            />
          </div>

          {/* Availability */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-availability">Availability</label>
            <select
              id="p-availability"
              className="form-select"
              name="availability"
              value={formData.availability}
              onChange={handleChange}
            >
              <option value="low">Low — a few hours/week</option>
              <option value="medium">Medium — part-time</option>
              <option value="high">High — full-time available</option>
            </select>
          </div>

          {/* Contact Method */}
          <div className="form-group">
            <label className="form-label" htmlFor="p-contactMethod">Preferred Contact Method</label>
            <select
              id="p-contactMethod"
              className="form-select"
              name="contactMethod"
              value={formData.contactMethod}
              onChange={handleChange}
            >
              <option value="email">Email</option>
              <option value="chat">Chat (in-app)</option>
              <option value="in-person">In-person</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;
