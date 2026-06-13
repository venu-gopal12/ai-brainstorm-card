import { DrillDownPanel } from './DrillDownPanel';
import type { BrainstormIdea, DrillDown } from '../../types';

interface IdeaCardProps {
  idea: BrainstormIdea;
  index: number;
  copied: boolean;
  posted: boolean;
  posting: boolean;
  drilling: boolean;
  drillOpen: boolean;
  drillData?: DrillDown;
  onCopy: (idea: BrainstormIdea, index: number) => void;
  onShare: (idea: BrainstormIdea) => void;
  onPost: (idea: BrainstormIdea, index: number) => void;
  onDrill: (idea: BrainstormIdea, index: number) => void;
}

export function IdeaCard({
  idea,
  index,
  copied,
  posted,
  posting,
  drilling,
  drillOpen,
  drillData,
  onCopy,
  onShare,
  onPost,
  onDrill,
}: IdeaCardProps) {
  return (
    <div className="idea-card">
      <div className="idea-number">{index + 1}</div>
      <div className="idea-content">
        <h3 className="idea-title">{idea.title}</h3>
        <p className="idea-desc">{idea.description}</p>
        <div className="idea-actions">
          <button className={`idea-action-btn ${copied ? 'copied' : ''}`} onClick={() => onCopy(idea, index)}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button className="idea-action-btn" onClick={() => onShare(idea)}>📤 Share</button>
          <button
            className={`idea-action-btn ${posted ? 'posted' : ''}`}
            onClick={() => onPost(idea, index)}
            disabled={posting || posted}
          >
            {posting ? '...' : posted ? '✓ Posted' : '📌 Post'}
          </button>
          <button
            className={`idea-action-btn drill-btn ${drillOpen ? 'drill-open' : ''}`}
            onClick={() => onDrill(idea, index)}
            disabled={drilling}
          >
            {drilling ? '⏳' : drillOpen ? '▲ Less' : '🔍 Drill'}
          </button>
        </div>

        {drillOpen && drillData && <DrillDownPanel drillData={drillData} />}
      </div>
    </div>
  );
}
