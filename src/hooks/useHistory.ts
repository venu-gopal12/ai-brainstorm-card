import { useCallback, useRef, useState } from 'react';
import type { CardSdk } from 'dome-embedded-app-sdk';
import { getCardFS } from '../services/cardFs';
import { safeNormalizeIdeas } from '../utils/ideas';
import type { BrainstormIdea, HistorySession, Mode } from '../types';

function sortSessions(sessions: HistorySession[]) {
  return [...sessions].sort((a, b) => b.savedAt - a.savedAt);
}

function mergeSessions(localSessions: HistorySession[], serverSessions: HistorySession[]) {
  const merged = new Map<string, HistorySession>();

  localSessions.forEach((session) => {
    merged.set(session.filename, {
      ...session,
      ideas: safeNormalizeIdeas(session.ideas),
    });
  });

  serverSessions.forEach((session) => {
    merged.set(session.filename, {
      ...session,
      ideas: safeNormalizeIdeas(session.ideas),
    });
  });

  return sortSessions([...merged.values()]).slice(0, 10);
}

export function useHistory(sdk: CardSdk | null) {
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const loadRequestId = useRef(0);

  const loadHistory = useCallback(async () => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;

    if (!sdk) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError('');
    try {
      const fs = getCardFS(sdk);
      const result = await fs.list('history/');
      const files = (result?.files ?? [])
        .filter((file) => file.startsWith('history/') && file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a));

      if (loadRequestId.current !== requestId) return;

      if (files.length === 0) {
        setHistory((prev) => sortSessions(prev).slice(0, 10));
        return;
      }

      const recentFiles = files.slice(0, 10);
      const results = await Promise.allSettled(recentFiles.map((file) => fs.readFile(file)));
      const sessions: HistorySession[] = [];

      if (loadRequestId.current !== requestId) return;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          try {
            const data = JSON.parse(result.value);
            if (data?.savedAt && data?.topic) {
              sessions.push({
                ...data,
                filename: recentFiles[index],
                ideas: safeNormalizeIdeas(data.ideas),
              });
            }
          } catch {
            // Ignore malformed history files.
          }
        }
      });

      setHistory((prev) => mergeSessions(prev, sessions));
    } catch (err) {
      console.error('[History] load error:', err);
      if (loadRequestId.current === requestId) {
        setHistory([]);
        setHistoryError('Could not load history. Please try again.');
      }
    } finally {
      if (loadRequestId.current === requestId) {
        setHistoryLoading(false);
      }
    }
  }, [sdk]);

  const saveToHistory = async (topic: string, mode: Mode, ideas: BrainstormIdea[]) => {
    if (!sdk) return;
    const ts = Date.now();
    const filename = `history/session-${ts}.json`;
    const sessionData: HistorySession = { filename, topic, mode: mode.id, ideas, savedAt: ts };

    setHistory((prev) => mergeSessions(prev, [sessionData]));
    setSavedMsg('Saved to history ✓');
    window.setTimeout(() => setSavedMsg(''), 2500);

    const fs = getCardFS(sdk);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await fs.writeFile(filename, JSON.stringify(sessionData));
        window.setTimeout(() => {
          void loadHistory();
        }, 800);
        return;
      } catch {
        if (attempt < 3) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
        }
      }
    }
  };

  const deleteSession = async (filename: string) => {
    if (!sdk) return;
    try {
      await getCardFS(sdk).deleteFile(filename);
      setHistory((prev) => prev.filter((session) => session.filename !== filename));
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  return {
    history,
    historyLoading,
    historyError,
    savedMsg,
    loadHistory,
    deleteSession,
    saveToHistory,
  };
}
