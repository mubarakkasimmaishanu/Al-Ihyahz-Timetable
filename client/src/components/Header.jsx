import React from 'react';
import { Sparkles, RotateCcw, Sliders, Layers, Printer } from 'lucide-react';

export default function Header({ 
  settings, 
  onGenerate, 
  isGenerating, 
  onResetDemo, 
  onOpenAllocations, 
  onOpenSettings,
  onPrintCurrentView 
}) {
  return (
    <header className="school-header-banner no-print">
      <div className="header-top">
        <div className="school-identity">
          <span className="school-brand-title">
            {settings.school_name || 'AL-IHYAZ ACADEMY'}
          </span>
          <span className="school-brand-session">
            {settings.academic_session || '2025/26'}
          </span>
        </div>

        <div className="header-actions">
          <button 
            id="btn-auto-generate"
            className="btn btn-generate" 
            onClick={onGenerate}
            disabled={isGenerating}
            title="Compute conflict-free timetable"
          >
            <Sparkles size={15} className={isGenerating ? 'spin-icon' : ''} />
            {isGenerating ? 'Generating...' : 'Auto-Generate'}
          </button>

          <button 
            id="btn-print-view"
            className="btn btn-print"
            onClick={onPrintCurrentView}
            title="Print timetable"
          >
            <Printer size={15} />
            Print
          </button>

          <button 
            id="btn-manage-allocations"
            className="btn btn-outline" 
            onClick={onOpenAllocations}
            title="Curriculum, teachers & class allocations"
          >
            <Layers size={15} />
            Curriculum & Allocations
          </button>

          <button 
            id="btn-school-settings"
            className="btn btn-outline" 
            onClick={onOpenSettings}
            title="School Settings"
          >
            <Sliders size={15} />
            Settings
          </button>

          <button 
            id="btn-reset-demo"
            className="btn btn-ghost" 
            onClick={onResetDemo}
            title="Reset to Demo Data"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
