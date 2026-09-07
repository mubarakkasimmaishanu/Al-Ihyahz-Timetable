import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function ConflictBanner({ validation }) {
  if (!validation) return null;

  const hasCritical = validation.conflicts && validation.conflicts.length > 0;
  const hasWarnings = validation.warnings && validation.warnings.length > 0;

  if (hasCritical) {
    return (
      <div className="conflict-banner has-errors" id="conflict-banner-alert">
        <XCircle className="conflict-icon" size={24} />
        <div className="conflict-details">
          <div className="conflict-title">
            ⚠️ Attention: {validation.conflicts.length} Critical Clash(es) Detected!
          </div>
          <p>The following scheduling collisions violate hard timetable rules:</p>
          <ul className="conflict-list">
            {validation.conflicts.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (hasWarnings) {
    return (
      <div className="conflict-banner is-warning" id="conflict-banner-warning">
        <AlertTriangle className="conflict-icon" size={24} />
        <div className="conflict-details">
          <div className="conflict-title">
            Timetable Generated with {validation.warnings.length} Advisory Warning(s)
          </div>
          <ul className="conflict-list">
            {validation.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-banner is-success no-print" id="conflict-banner-success">
      <CheckCircle2 className="conflict-icon" size={22} />
      <div className="conflict-details">
        <div className="conflict-title">
          100% Conflict-Free Timetable Generated
        </div>
        <p>
          Zero teacher double-bookings • Zero class subject overlaps • Friday Juma'at hours strictly observed.
        </p>
      </div>
    </div>
  );
}
