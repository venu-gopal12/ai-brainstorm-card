import { formatDate, getModeById } from '../../utils/helpers';
import { safeNormalizeIdeas } from '../../utils/ideas';
import type { HistorySession } from '../../types';

interface HistoryCardProps {
  session: HistorySession;
  onLoad: (session: HistorySession) => void;
  onDelete: (filename: string) => void;
}

export function HistoryCard({ session, onLoad, onDelete }: HistoryCardProps) {
  const mode = getModeById(session.mode);
  const ideas = safeNormalizeIdeas(session.ideas);

  return (
    <div className="history-card">
      <div className="history-card-header">
        <div>
          <p className="history-topic">"{session.topic}"</p>
          <p className="history-date">
            <span className="history-mode-tag">{mode.emoji} {mode.label}</span>&nbsp;· {formatDate(session.savedAt)}
          </p>
        </div>
        <div className="history-actions">
          <button className="history-load-btn" onClick={() => onLoad({ ...session, ideas })}>Load</button>
          <button className="history-delete-btn" onClick={() => onDelete(session.filename)}>✕</button>
        </div>
      </div>
      <div className="history-preview">
        {ideas.slice(0, 2).map((idea, index) => (
          <p key={index} className="history-idea-preview">· {idea.title}</p>
        ))}
        {ideas.length === 0 && <p className="history-idea-preview">No preview available</p>}
        {ideas.length > 2 && <p className="history-more">+{ideas.length - 2} more</p>}
      </div>
    </div>
  );
}
