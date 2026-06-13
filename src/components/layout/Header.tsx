import type { Tab } from '../../types';

interface HeaderProps {
  userName: string;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Header({ userName, tab, onTabChange }: HeaderProps) {
  return (
    <div className="header">
      <div className="header-top">
        <span className="logo">💡</span>
        <div>
          <h1 className="app-title">Brainstorm</h1>
          <p className="app-subtitle">Hi, {userName}</p>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab-btn ${tab === 'brainstorm' ? 'active' : ''}`} onClick={() => onTabChange('brainstorm')}>
          Generate
        </button>
        <button className={`tab-btn ${tab === 'board' ? 'active' : ''}`} onClick={() => onTabChange('board')}>
          Board
        </button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => onTabChange('history')}>
          History
        </button>
      </div>
    </div>
  );
}
