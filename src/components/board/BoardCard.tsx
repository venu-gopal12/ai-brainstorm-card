import { avatarColor, formatDate, getInitials, getModeById } from '../../utils/helpers';
import type { BoardPost } from '../../types';

interface BoardCardProps {
  post: BoardPost;
  rank: number;
  sortBy: 'recent' | 'votes';
  myId: string;
  myName: string;
  votes: string[];
  voting: boolean;
  deleting: boolean;
  onVote: (postId: string) => void;
  onDelete: (post: BoardPost) => void;
}

export function BoardCard({
  post,
  rank,
  sortBy,
  myId,
  myName,
  votes,
  voting,
  deleting,
  onVote,
  onDelete,
}: BoardCardProps) {
  const mode = getModeById(post.mode);
  const isOwn = post.authorId === myId || post.authorName.trim().toLowerCase() === myName.trim().toLowerCase();
  const color = avatarColor(post.authorName);
  const hasVoted = votes.includes(myId);
  const voteCount = votes.length;
  const isTop = sortBy === 'votes' && rank === 0 && voteCount > 0;

  return (
    <div className={`board-card ${isTop ? 'board-card-top-ranked' : ''}`}>
      {isTop && <div className="top-badge">🏆 Top idea</div>}
      <div className="board-card-top">
        <div className="board-author">
          <div className="avatar" style={{ background: color }}>{getInitials(post.authorName)}</div>
          <div>
            <p className="author-name">{isOwn ? 'You' : post.authorName}</p>
            <p className="board-meta">{mode.emoji} {mode.label} · {formatDate(post.postedAt)}</p>
          </div>
        </div>
        <div className="board-right">
          <button className={`vote-btn ${hasVoted ? 'voted' : ''}`} onClick={() => onVote(post.id)} disabled={voting}>
            <span className="vote-icon">▲</span>
            <span className="vote-count">{voteCount}</span>
          </button>
          {isOwn && (
            <button className="board-delete-btn" onClick={() => onDelete(post)} disabled={deleting}>
              {deleting ? '...' : '✕'}
            </button>
          )}
        </div>
      </div>
      <div className="board-idea">
        <p className="board-idea-title">{post.title}</p>
        <p className="board-idea-desc">{post.description}</p>
        {post.topic && <p className="board-topic-tag">re: {post.topic}</p>}
      </div>
    </div>
  );
}
