import React, { useState, useEffect } from 'react';
import { Sliders, X, Save } from 'lucide-react';
import { saveSettings } from '../services/api.js';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsUpdated 
}) {
  const [formData, setFormData] = useState({
    school_name: '',
    school_motto: '',
    school_address: '',
    academic_session: '',
    current_term: '',
    regular_periods_per_day: 8,
    friday_periods_per_day: 5
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        school_name: settings.school_name || 'AL-IHYAHZ ISLAMIC & SECONDARY SCHOOL',
        school_motto: settings.school_motto || 'Excellence in Character, Faith and Academic Learning',
        school_address: settings.school_address || 'Northern Region, Nigeria',
        academic_session: settings.academic_session || '2026/2027 Academic Session',
        current_term: settings.current_term || 'First Term',
        regular_periods_per_day: Number(settings.regular_periods_per_day || 8),
        friday_periods_per_day: Number(settings.friday_periods_per_day || 5)
      });
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveSettings(formData);
      onSettingsUpdated();
      onClose();
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders className="text-primary" size={22} />
            <h2 style={{ fontSize: '1.2rem' }}>School & Timetable Settings</h2>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">School Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.school_name}
                onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">School Motto</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.school_motto}
                onChange={(e) => setFormData({ ...formData, school_motto: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Academic Session</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.academic_session}
                  onChange={(e) => setFormData({ ...formData, academic_session: e.target.value })}
                  placeholder="2026/2027"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Term</label>
                <select 
                  className="form-input"
                  value={formData.current_term}
                  onChange={(e) => setFormData({ ...formData, current_term: e.target.value })}
                >
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label">Regular Periods / Day (Mon - Thu)</label>
                <input 
                  type="number" 
                  min="4" 
                  max="10" 
                  className="form-input" 
                  value={formData.regular_periods_per_day}
                  onChange={(e) => setFormData({ ...formData, regular_periods_per_day: Number(e.target.value) })}
                />
                <small style={{ color: '#64748b' }}>Standard is 8 periods per day</small>
              </div>

              <div className="form-group">
                <label className="form-label">Friday Periods (Juma'at Closing)</label>
                <input 
                  type="number" 
                  min="3" 
                  max="6" 
                  className="form-input" 
                  value={formData.friday_periods_per_day}
                  onChange={(e) => setFormData({ ...formData, friday_periods_per_day: Number(e.target.value) })}
                />
                <small style={{ color: '#64748b' }}>Closes early at 12:00 PM for Juma'at (5 periods)</small>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
