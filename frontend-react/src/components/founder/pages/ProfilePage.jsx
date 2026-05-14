import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const ProfilePage = ({ startup, refetch }) => {
  const [formData, setFormData] = useState({
    name: '',
    thesis: '',
    targetUsers: '',
    industry: 'General'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (startup) {
      setFormData({
        name: startup.name || '',
        thesis: startup.thesis || '',
        targetUsers: startup.targetUsers || '',
        industry: startup.industry || 'General'
      });
    }
  }, [startup]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const startupData = {
      name: formData.name,
      thesis: formData.thesis,
      industry: formData.industry,
      targetUsers: formData.targetUsers
    };

    try {
      if (startup) {
        await api.updateStartup(startupData);
        toast.success('Profile updated successfully!');
      } else {
        await api.createStartup(startupData);
        toast.success('Startup created successfully!');
      }

      // Refresh dashboard data
      if (refetch) refetch();
    } catch (error) {
      toast.error(`Failed to save profile: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader 
        title="Startup Profile" 
        subtitle="Manage your startup information" 
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Startup Name</label>
            <input
              type="text"
              className="form-input"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Problem Statement</label>
            <textarea
              className="form-textarea"
              name="thesis"
              rows="4"
              value={formData.thesis}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target Users</label>
            <input
              type="text"
              className="form-input"
              name="targetUsers"
              value={formData.targetUsers}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Industry</label>
            <select
              className="form-select"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              required
            >
              <option value="General">General</option>
              <option value="Technology">Technology</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Fintech">Fintech</option>
              <option value="Retail/E-commerce">Retail/E-commerce</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;
