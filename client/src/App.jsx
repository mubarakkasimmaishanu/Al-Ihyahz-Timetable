import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Layers, Sliders, RotateCcw, Printer, AlertTriangle } from 'lucide-react';

import ClassView from './components/ClassView.jsx';
import TeacherView from './components/TeacherView.jsx';
import GeneralView from './components/GeneralView.jsx';
import AllocationsModal from './components/AllocationsModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';

import {
  fetchTeachers,
  fetchClasses,
  fetchSubjects,
  fetchAllocations,
  fetchSettings,
  fetchTimetable,
  generateTimetable,
  validateTimetableApi,
  resetToDemoData
} from './services/api.js';

export default function App() {
  // Navigation tabs: 'TEACHER', 'CLASS', 'GENERAL'
  const [activeTab, setActiveTab] = useState('TEACHER');

  // Application Data States
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [slots, setSlots] = useState([]);
  const [validation, setValidation] = useState(null);

  // UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllocationsModalOpen, setIsAllocationsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Load all data
  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [tData, cData, sData, aData, setts, timetable] = await Promise.all([
        fetchTeachers(),
        fetchClasses(),
        fetchSubjects(),
        fetchAllocations(),
        fetchSettings(),
        fetchTimetable()
      ]);

      setTeachers(tData);
      setClasses(cData);
      setSubjects(sData);
      setAllocations(aData);
      setSettings(setts);
      setSlots(timetable);

      if (timetable.length > 0) {
        const val = await validateTimetableApi();
        setValidation(val);
      } else {
        setValidation(null);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Automatic Timetable Generation
  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const res = await generateTimetable();
      setSlots(res.slots);
      setValidation(res.validation);
      alert(`Timetable Generated Successfully!\n• Placed Lessons: ${res.totalSlots} periods\n• Clashes: 0`);
    } catch (err) {
      alert(`Generation Notice: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Reset to Northern Nigerian Demo Data
  const handleResetDemo = async () => {
    if (!confirm('Reset timetable database to clean Northern Nigerian secondary school sample data?')) {
      return;
    }
    try {
      await resetToDemoData();
      await loadAllData();
      alert('Timetable restored successfully.');
    } catch (err) {
      alert('Error resetting demo data: ' + err.message);
    }
  };

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  const hasClashes = validation && !validation.valid && validation.clashes && validation.clashes.length > 0;

  return (
    <div className="app-container">
      {/* Clean, Simple, Non-Flashy Application Toolbar */}
      <header className="clean-toolbar no-print">
        {/* Left: 3 Required Views */}
        <div className="clean-nav-tabs">
          <button 
            id="tab-by-teacher"
            className={`clean-tab-btn ${activeTab === 'TEACHER' ? 'active' : ''}`}
            onClick={() => setActiveTab('TEACHER')}
          >
            By Teacher
          </button>

          <button 
            id="tab-my-class"
            className={`clean-tab-btn ${activeTab === 'CLASS' ? 'active' : ''}`}
            onClick={() => setActiveTab('CLASS')}
          >
            My Class
          </button>

          <button 
            id="tab-general-view"
            className={`clean-tab-btn ${activeTab === 'GENERAL' ? 'active' : ''}`}
            onClick={() => setActiveTab('GENERAL')}
          >
            General View
          </button>
        </div>

        {/* Right: Functional Tool Actions */}
        <div className="clean-actions">
          <button 
            id="btn-auto-generate"
            className="clean-btn clean-btn-primary" 
            onClick={handleGenerate}
            disabled={isGenerating}
            title="Generate conflict-free schedule"
          >
            <Sparkles size={14} className={isGenerating ? 'spin-icon' : ''} />
            {isGenerating ? 'Generating...' : 'Auto-Generate'}
          </button>

          <button 
            id="btn-print-view"
            className="clean-btn"
            onClick={handlePrint}
            title="Print active timetable"
          >
            <Printer size={14} />
            Print
          </button>

          <button 
            id="btn-manage-allocations"
            className="clean-btn" 
            onClick={() => setIsAllocationsModalOpen(true)}
            title="Manage curriculum, teachers & class allocations"
          >
            <Layers size={14} />
            Curriculum & Allocations
          </button>

          <button 
            id="btn-school-settings"
            className="clean-btn" 
            onClick={() => setIsSettingsModalOpen(true)}
            title="Settings"
          >
            <Sliders size={14} />
            Settings
          </button>

          <button 
            id="btn-reset-demo"
            className="clean-btn clean-btn-ghost" 
            onClick={handleResetDemo}
            title="Reset to clean demo data"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </header>

      {/* Warning banner ONLY if there are clashes */}
      {hasClashes && (
        <div className="clean-clash-warning no-print">
          <AlertTriangle size={16} />
          <span>Warning: {validation.clashes.length} scheduling clash detected. Please click Auto-Generate to resolve.</span>
        </div>
      )}

      {/* Main Timetable Content */}
      <main className="main-content">
        {activeTab === 'TEACHER' && (
          <TeacherView 
            teachers={teachers}
            classes={classes}
            allocations={allocations}
            slots={slots}
            settings={settings}
          />
        )}

        {activeTab === 'CLASS' && (
          <ClassView 
            classes={classes}
            teachers={teachers}
            allocations={allocations}
            slots={slots}
            settings={settings}
          />
        )}

        {activeTab === 'GENERAL' && (
          <GeneralView 
            classes={classes}
            teachers={teachers}
            slots={slots}
            settings={settings}
          />
        )}
      </main>

      {/* Curriculum & Allocations Modal */}
      <AllocationsModal 
        isOpen={isAllocationsModalOpen}
        onClose={() => setIsAllocationsModalOpen(false)}
        classes={classes}
        teachers={teachers}
        subjects={subjects}
        allocations={allocations}
        onRefreshData={loadAllData}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsUpdated={loadAllData}
      />
    </div>
  );
}
