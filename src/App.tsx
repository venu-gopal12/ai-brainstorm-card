import { useEffect, useState } from 'react';
import './App.css';
import { BoardCard } from './components/board/BoardCard';
import { IdeaCard } from './components/brainstorm/IdeaCard';
import { ModeSelector } from './components/brainstorm/ModeSelector';
import { HistoryCard } from './components/history/HistoryCard';
import { Header } from './components/layout/Header';
import { useBoard } from './hooks/useBoard';
import { useBrainstorm } from './hooks/useBrainstorm';
import { useCardSdk } from './hooks/useCardSdk';
import { useHistory } from './hooks/useHistory';
import type { HistorySession, Tab } from './types';
import { getPlaceholder } from './utils/helpers';

function App() {
  const { user, sdk, initError } = useCardSdk();
  const [tab, setTab] = useState<Tab>('brainstorm');
  const historyState = useHistory(sdk);
  const brainstormState = useBrainstorm({
    saveToHistory: historyState.saveToHistory,
  });
  const boardState = useBoard(sdk, user, brainstormState.topic, brainstormState.selectedMode);
  const { loadHistory } = historyState;
  const { loadBoardForTab } = boardState;

  useEffect(() => {
    if (tab === 'history' && sdk) {
      loadHistory();
    }
    if (tab === 'board' && sdk) {
      loadBoardForTab();
    }
  }, [tab, sdk, loadHistory, loadBoardForTab]);

  const loadSession = (session: HistorySession) => {
    brainstormState.loadSession(session);
    boardState.resetPostedIndexes();
    setTab('brainstorm');
  };

  const changeMode = (mode: typeof brainstormState.selectedMode) => {
    brainstormState.changeMode(mode);
    boardState.resetPostedIndexes();
  };

  const resetBrainstorm = () => {
    brainstormState.reset();
    boardState.resetPostedIndexes();
  };

  const generateIdeas = async () => {
    boardState.resetPostedIndexes();
    await brainstormState.brainstorm();
  };

  if (initError) {
    return (
      <div className="main">
        <div className="error-card">
          <h3>Initialization Failed</h3>
          <p>{initError.message}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="main">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const myId = user.getId?.() ?? '';
  const myName = user.getFullName?.() ?? '';

  return (
    <div className="main">
      <Header userName={user.getFullName?.() ?? 'there'} tab={tab} onTabChange={setTab} />

      {tab === 'brainstorm' && (
        <>
          <ModeSelector selectedMode={brainstormState.selectedMode} onSelect={changeMode} />

          <div className="input-section">
            <input
              type="text"
              className="topic-input"
              placeholder={`${brainstormState.selectedMode.emoji} ${getPlaceholder(brainstormState.selectedMode.id)}`}
              value={brainstormState.topic}
              onChange={(event) => brainstormState.setTopic(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && generateIdeas()}
              disabled={brainstormState.loading}
            />
            <button
              className="brainstorm-btn"
              onClick={generateIdeas}
              disabled={brainstormState.loading || !brainstormState.topic.trim()}
            >
              {brainstormState.loading ? 'Thinking...' : `Generate ${brainstormState.selectedMode.label} Ideas`}
            </button>
          </div>

          {historyState.savedMsg && <div className="saved-msg">{historyState.savedMsg}</div>}

          {brainstormState.loading && (
            <div className="thinking">
              <div className="thinking-dots"><span /><span /><span /></div>
              <p>Generating {brainstormState.selectedMode.label.toLowerCase()} ideas for "{brainstormState.topic}"...</p>
            </div>
          )}

          {brainstormState.error && (
            <div className="error-card">
              <p>⚠️ {brainstormState.error}</p>
            </div>
          )}

          {brainstormState.ideas.length > 0 && (
            <>
              <div className="results-header">
                <p className="results-label">
                  <span className="results-mode-badge">
                    {brainstormState.selectedMode.emoji} {brainstormState.selectedMode.label}
                  </span>
                  &nbsp;· 5 ideas
                </p>
                <div className="results-actions">
                  <button className="icon-action-btn" title="Copy all" onClick={brainstormState.copyAllIdeas}>
                    {brainstormState.copiedAll ? '✓' : '📋'}
                  </button>
                  <button className="icon-action-btn" title="Share all" onClick={brainstormState.shareAllIdeas}>📤</button>
                  <button className="reset-btn" onClick={resetBrainstorm}>New</button>
                </div>
              </div>

              <div className="ideas-list">
                {brainstormState.ideas.map((idea, index) => (
                  <IdeaCard
                    key={`${idea.title}-${index}`}
                    idea={idea}
                    index={index}
                    copied={brainstormState.copiedIndex === index}
                    posted={boardState.postedIndexes.has(index)}
                    posting={boardState.postingIndex === index}
                    drilling={brainstormState.drillingIndex === index}
                    drillOpen={brainstormState.expandedDrill === index}
                    drillData={brainstormState.drillData[index]}
                    onCopy={brainstormState.copyIdea}
                    onShare={brainstormState.shareIdea}
                    onPost={boardState.postToBoard}
                    onDrill={brainstormState.drillInto}
                  />
                ))}
              </div>
            </>
          )}

          {brainstormState.hasSearched && !brainstormState.loading && brainstormState.ideas.length === 0 && !brainstormState.error && (
            <div className="empty-state"><p>No ideas generated. Try a different topic.</p></div>
          )}
        </>
      )}

      {tab === 'board' && (
        <div className="board-section">
          <div className="board-header">
            <p className="board-desc">Ideas shared by dome members</p>
            <div className="board-controls">
              <select
                className="sort-select"
                value={boardState.sortBy}
                onChange={(event) => boardState.setSortBy(event.target.value as 'recent' | 'votes')}
              >
                <option value="votes">Top voted</option>
                <option value="recent">Most recent</option>
              </select>
              <button className="refresh-btn" onClick={boardState.loadBoard} disabled={boardState.boardLoading}>
                {boardState.boardLoading ? '...' : '↻'}
              </button>
            </div>
          </div>

          {boardState.boardLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading board...</p>
            </div>
          )}

          {!boardState.boardLoading && boardState.board.length === 0 && (
            <div className="empty-state">
              <p>No ideas posted yet.</p>
              <p style={{ marginTop: 6 }}>Generate ideas and tap 📌 Post to share.</p>
            </div>
          )}

          {!boardState.boardLoading && boardState.sortedBoard.map((post, rank) => (
            <BoardCard
              key={post.id}
              post={post}
              rank={rank}
              sortBy={boardState.sortBy}
              myId={myId}
              myName={myName}
              votes={boardState.votes[post.id] ?? []}
              voting={boardState.votingId === post.id}
              deleting={boardState.deletingId === post.id}
              onVote={boardState.toggleVote}
              onDelete={boardState.deletePost}
            />
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="history-section">
          {historyState.historyLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading history...</p>
            </div>
          )}
          {!historyState.historyLoading && historyState.historyError && (
            <div className="error-card">
              <p>{historyState.historyError}</p>
            </div>
          )}
          {!historyState.historyLoading && !historyState.historyError && historyState.history.length === 0 && (
            <div className="empty-state">
              <p>No saved sessions yet.</p>
              <p style={{ marginTop: 6 }}>Generate ideas and they'll appear here.</p>
            </div>
          )}
          {!historyState.historyLoading && !historyState.historyError && historyState.history.map((session) => (
            <HistoryCard
              key={session.filename}
              session={session}
              onLoad={loadSession}
              onDelete={historyState.deleteSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
