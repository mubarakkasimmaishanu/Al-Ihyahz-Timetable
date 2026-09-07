import React, { useState } from 'react';
import { Plus, Trash2, Edit3, X, Check, BookOpen, Users, School, GraduationCap } from 'lucide-react';
import { 
  saveAllocation, deleteAllocation, 
  saveClass, deleteClass, 
  saveTeacher, deleteTeacher, 
  saveSubject, deleteSubject 
} from '../services/api.js';

export default function AllocationsModal({ 
  isOpen, 
  onClose, 
  classes, 
  teachers, 
  subjects, 
  allocations, 
  onRefreshData 
}) {
  const [activeTab, setActiveTab] = useState('allocations'); // allocations, classes, teachers, subjects

  // Form states for new allocation
  const [newAlloc, setNewAlloc] = useState({
    class_id: classes[0]?.id || '',
    subject_id: subjects[0]?.id || '',
    teacher_id: teachers[0]?.id || '',
    periods_per_week: 4,
    allow_double: 0
  });

  // Form states for new class
  const [newClass, setNewClass] = useState({
    name: '',
    level: 'JSS',
    arm: 'A',
    room: '',
    class_teacher: ''
  });

  // Form states for new teacher
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    code: '',
    phone: '',
    max_daily_periods: 5
  });

  // Form states for new subject
  const [newSubject, setNewSubject] = useState({
    name: '',
    code: '',
    category: 'General',
    color: '#15803d'
  });

  if (!isOpen) return null;

  // Handlers
  const handleAddAllocation = async (e) => {
    e.preventDefault();
    try {
      await saveAllocation(newAlloc);
      onRefreshData();
      alert('Allocation added successfully!');
    } catch (err) {
      alert('Error adding allocation: ' + err.message);
    }
  };

  const handleDeleteAllocation = async (id) => {
    if (!confirm('Remove this allocation?')) return;
    try {
      await deleteAllocation(id);
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    try {
      await saveClass(newClass);
      setNewClass({ name: '', level: 'JSS', arm: 'A', room: '', class_teacher: '' });
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!confirm('Delete this class and its allocations?')) return;
    try {
      await deleteClass(id);
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    try {
      await saveTeacher(newTeacher);
      setNewTeacher({ name: '', code: '', phone: '', max_daily_periods: 5 });
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!confirm('Delete this teacher and their allocations?')) return;
    try {
      await deleteTeacher(id);
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    try {
      await saveSubject(newSubject);
      setNewSubject({ name: '', code: '', category: 'General', color: '#15803d' });
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!confirm('Delete this subject and its allocations?')) return;
    try {
      await deleteSubject(id);
      onRefreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '1050px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen className="text-primary" size={24} />
            <h2 style={{ fontSize: '1.25rem' }}>Curriculum & Allocations Manager</h2>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Modal Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 24px' }}>
          <button 
            className={`tab-btn ${activeTab === 'allocations' ? 'active' : ''}`}
            onClick={() => setActiveTab('allocations')}
          >
            <BookOpen size={16} /> Lesson Allocations ({allocations.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            <School size={16} /> Classes ({classes.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`}
            onClick={() => setActiveTab('teachers')}
          >
            <Users size={16} /> Teachers ({teachers.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'subjects' ? 'active' : ''}`}
            onClick={() => setActiveTab('subjects')}
          >
            <GraduationCap size={16} /> Subjects ({subjects.length})
          </button>
        </div>

        <div className="modal-body">
          {/* TAB 1: ALLOCATIONS */}
          {activeTab === 'allocations' && (
            <div>
              <form onSubmit={handleAddAllocation} style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', color: '#166534', fontSize: '0.95rem' }}>+ Assign Subject to Teacher & Class</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Class</label>
                    <select 
                      className="form-input"
                      value={newAlloc.class_id}
                      onChange={(e) => setNewAlloc({ ...newAlloc, class_id: e.target.value })}
                      required
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <select 
                      className="form-input"
                      value={newAlloc.subject_id}
                      onChange={(e) => setNewAlloc({ ...newAlloc, subject_id: e.target.value })}
                      required
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Teacher</label>
                    <select 
                      className="form-input"
                      value={newAlloc.teacher_id}
                      onChange={(e) => setNewAlloc({ ...newAlloc, teacher_id: e.target.value })}
                      required
                    >
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} [{t.code}]</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Periods / Week</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      className="form-input"
                      value={newAlloc.periods_per_week}
                      onChange={(e) => setNewAlloc({ ...newAlloc, periods_per_week: Number(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Allow Double?</label>
                    <select 
                      className="form-input"
                      value={newAlloc.allow_double}
                      onChange={(e) => setNewAlloc({ ...newAlloc, allow_double: Number(e.target.value) })}
                    >
                      <option value={0}>No (Single periods only)</option>
                      <option value={1}>Yes (Allow 1 Double period)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                  <Plus size={16} /> Add Lesson Allocation
                </button>
              </form>

              {/* Allocations Table */}
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Class</th>
                      <th style={{ padding: '8px 12px' }}>Subject</th>
                      <th style={{ padding: '8px 12px' }}>Assigned Teacher</th>
                      <th style={{ padding: '8px 12px' }}>Periods/Wk</th>
                      <th style={{ padding: '8px 12px' }}>Double?</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{a.class_name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600, color: a.subject_color }}>{a.subject_name}</span> ({a.subject_code})
                        </td>
                        <td style={{ padding: '8px 12px' }}>{a.teacher_name} [{a.teacher_code}]</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{a.periods_per_week}</td>
                        <td style={{ padding: '8px 12px' }}>{a.allow_double ? '✅ Yes' : 'No'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteAllocation(a.id)}
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                            title="Delete allocation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CLASSES */}
          {activeTab === 'classes' && (
            <div>
              <form onSubmit={handleAddClass} style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>+ Add New Class Arm</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Class Name (e.g. JSS 1C or SSS 1 Comm)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={newClass.name}
                      onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                      placeholder="e.g. JSS 1C"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Level</label>
                    <select 
                      className="form-input"
                      value={newClass.level}
                      onChange={(e) => setNewClass({ ...newClass, level: e.target.value })}
                    >
                      <option value="JSS">Junior Secondary (JSS)</option>
                      <option value="SSS">Senior Secondary (SSS)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room / Hall</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newClass.room}
                      onChange={(e) => setNewClass({ ...newClass, room: e.target.value })}
                      placeholder="e.g. Block C, Room 3"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Form Teacher</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newClass.class_teacher}
                      onChange={(e) => setNewClass({ ...newClass, class_teacher: e.target.value })}
                      placeholder="e.g. Mallam Sani"
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Save Class
                </button>
              </form>

              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Class Name</th>
                      <th style={{ padding: '8px 12px' }}>Level</th>
                      <th style={{ padding: '8px 12px' }}>Classroom</th>
                      <th style={{ padding: '8px 12px' }}>Form Teacher</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{c.name}</td>
                        <td style={{ padding: '8px 12px' }}>{c.level}</td>
                        <td style={{ padding: '8px 12px' }}>{c.room || '-'}</td>
                        <td style={{ padding: '8px 12px' }}>{c.class_teacher || '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteClass(c.id)}
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TEACHERS */}
          {activeTab === 'teachers' && (
            <div>
              <form onSubmit={handleAddTeacher} style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>+ Register New Teacher</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={newTeacher.name}
                      onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                      placeholder="e.g. Mallam Haruna Bello"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teacher Code (2-4 letters)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={newTeacher.code}
                      onChange={(e) => setNewTeacher({ ...newTeacher, code: e.target.value })}
                      placeholder="e.g. HBL"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newTeacher.phone}
                      onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                      placeholder="080..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Daily Periods</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="8" 
                      className="form-input" 
                      value={newTeacher.max_daily_periods}
                      onChange={(e) => setNewTeacher({ ...newTeacher, max_daily_periods: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Save Teacher
                </button>
              </form>

              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Teacher Name</th>
                      <th style={{ padding: '8px 12px' }}>Code</th>
                      <th style={{ padding: '8px 12px' }}>Weekly Periods</th>
                      <th style={{ padding: '8px 12px' }}>Max/Day</th>
                      <th style={{ padding: '8px 12px' }}>Phone</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{t.name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className="meta-teacher-code">{t.code}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.total_periods || 0} periods</td>
                        <td style={{ padding: '8px 12px' }}>{t.max_daily_periods}</td>
                        <td style={{ padding: '8px 12px' }}>{t.phone || '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteTeacher(t.id)}
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SUBJECTS */}
          {activeTab === 'subjects' && (
            <div>
              <form onSubmit={handleAddSubject} style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>+ Add New Subject</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Subject Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={newSubject.name}
                      onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                      placeholder="e.g. Further Mathematics"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Code (3-5 letters)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={newSubject.code}
                      onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                      placeholder="e.g. FMTH"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newSubject.category}
                      onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value })}
                      placeholder="e.g. Science"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Badge Color</label>
                    <input 
                      type="color" 
                      className="form-input" 
                      style={{ height: '42px', padding: '2px' }}
                      value={newSubject.color}
                      onChange={(e) => setNewSubject({ ...newSubject, color: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Save Subject
                </button>
              </form>

              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Subject Name</th>
                      <th style={{ padding: '8px 12px' }}>Code</th>
                      <th style={{ padding: '8px 12px' }}>Category</th>
                      <th style={{ padding: '8px 12px' }}>Color Tag</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{s.name}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{s.code}</td>
                        <td style={{ padding: '8px 12px' }}>{s.category}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '4px', background: s.color }}></span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteSubject(s.id)}
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
