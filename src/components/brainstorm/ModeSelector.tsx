import { MODES } from '../../utils/constants';
import type { Mode } from '../../types';

interface ModeSelectorProps {
  selectedMode: Mode;
  onSelect: (mode: Mode) => void;
}

export function ModeSelector({ selectedMode, onSelect }: ModeSelectorProps) {
  return (
    <div className="mode-section">
      <p className="mode-label">Mode</p>
      <div className="mode-grid">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-btn ${selectedMode.id === mode.id ? 'active' : ''}`}
            onClick={() => onSelect(mode)}
          >
            <span className="mode-emoji">{mode.emoji}</span>
            <span className="mode-name">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
