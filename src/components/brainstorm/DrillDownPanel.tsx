import type { DrillDown } from '../../types';

interface DrillDownPanelProps {
  drillData: DrillDown;
}

export function DrillDownPanel({ drillData }: DrillDownPanelProps) {
  return (
    <div className="drill-panel">
      <div className="drill-section">
        <p className="drill-section-title">✅ Action steps</p>
        {drillData.steps.map((step, index) => (
          <p key={index} className="drill-item">· {step}</p>
        ))}
      </div>
      <div className="drill-section">
        <p className="drill-section-title">⚠️ Risks</p>
        {drillData.risks.map((risk, index) => (
          <p key={index} className="drill-item">· {risk}</p>
        ))}
      </div>
      <div className="drill-section">
        <p className="drill-section-title">🧰 Resources needed</p>
        {drillData.resources.map((resource, index) => (
          <p key={index} className="drill-item">· {resource}</p>
        ))}
      </div>
    </div>
  );
}
