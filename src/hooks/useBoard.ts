import { useCallback, useMemo, useRef, useState } from 'react';
import type { CardSdk, CardUser } from 'dome-embedded-app-sdk';
import { getCardFS } from '../services/cardFs';
import { VOTES_FILE } from '../utils/constants';
import type { BoardPost, BoardSort, BrainstormIdea, Mode, VoteData } from '../types';

export function useBoard(
  sdk: CardSdk | null,
  user: CardUser | null,
  topic: string,
  selectedMode: Mode,
) {
  const [board, setBoard] = useState<BoardPost[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [votes, setVotes] = useState<VoteData>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<BoardSort>('votes');
  const [postingIndex, setPostingIndex] = useState<number | null>(null);
  const [postedIndexes, setPostedIndexes] = useState<Set<number>>(new Set());
  const justPosted = useRef(false);

  const isOwnPost = useCallback((post: BoardPost) => {
    if (!user) return false;
    const myId = user.getId?.() ?? '';
    const myName = user.getFullName?.() ?? '';
    return post.authorId === myId || post.authorName.trim().toLowerCase() === myName.trim().toLowerCase();
  }, [user]);

  const loadVotes = useCallback(async () => {
    if (!sdk) return;
    try {
      const raw = await getCardFS(sdk).readFile(VOTES_FILE, true);
      setVotes(JSON.parse(raw));
    } catch {
      setVotes({});
    }
  }, [sdk]);

  const saveVotes = useCallback(async (updated: VoteData) => {
    if (!sdk) return;
    await getCardFS(sdk).writeFile(VOTES_FILE, JSON.stringify(updated), true);
  }, [sdk]);

  const loadBoard = useCallback(async () => {
    if (!sdk) return;
    setBoardLoading(true);
    try {
      const fs = getCardFS(sdk);
      const result = await fs.list('', true);
      const files = (result?.files ?? []).filter((file) => file.startsWith('post-') && file.endsWith('.json'));
      const results = await Promise.allSettled(files.map((file) => fs.readFile(file, true)));
      const posts: BoardPost[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          try {
            posts.push(JSON.parse(result.value));
          } catch {
            // Ignore malformed posts.
          }
        }
      });

      posts.sort((a, b) => b.postedAt - a.postedAt);
      setBoard((prev) => {
        const serverIds = new Set(posts.map((post) => post.id));
        const optimisticOnly = prev.filter((post) => !serverIds.has(post.id));
        return [...optimisticOnly, ...posts].sort((a, b) => b.postedAt - a.postedAt);
      });
      await loadVotes();
    } catch (err) {
      console.error('Failed to load board', err);
    } finally {
      setBoardLoading(false);
    }
  }, [loadVotes, sdk]);

  const loadBoardForTab = useCallback(() => {
    if (justPosted.current) {
      justPosted.current = false;
      return;
    }
    window.setTimeout(() => loadBoard(), 800);
  }, [loadBoard]);

  const toggleVote = async (postId: string) => {
    if (!sdk || !user) return;
    const myId = user.getId?.() ?? '';
    setVotingId(postId);
    try {
      const current = votes[postId] ?? [];
      const hasVoted = current.includes(myId);
      const updated: VoteData = {
        ...votes,
        [postId]: hasVoted ? current.filter((id) => id !== myId) : [...current, myId],
      };
      setVotes(updated);
      await saveVotes(updated);
    } catch (err) {
      console.error('Vote failed', err);
    } finally {
      setVotingId(null);
    }
  };

  const postToBoard = async (idea: BrainstormIdea, index: number) => {
    if (!sdk || !user) return;
    setPostingIndex(index);
    try {
      const fs = getCardFS(sdk);
      const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`;
      const post: BoardPost = {
        id,
        title: idea.title,
        description: idea.description,
        topic,
        mode: selectedMode.id,
        authorId: user.getId?.() ?? 'unknown',
        authorName: user.getFullName?.() ?? 'Anonymous',
        postedAt: Date.now(),
      };
      await fs.writeFile(id, JSON.stringify(post), true);
      setPostedIndexes((prev) => new Set(prev).add(index));
      setBoard((prev) => [post, ...prev]);
      justPosted.current = true;
    } catch (err) {
      console.error('Failed to post', err);
    } finally {
      setPostingIndex(null);
    }
  };

  const deletePost = async (post: BoardPost) => {
    if (!sdk || !user) return;
    if (!isOwnPost(post)) return;
    setDeletingId(post.id);
    try {
      await getCardFS(sdk).deleteFile(post.id, true);
      setBoard((prev) => prev.filter((boardPost) => boardPost.id !== post.id));
      const updated = { ...votes };
      delete updated[post.id];
      setVotes(updated);
      await saveVotes(updated);
    } catch (err) {
      console.error('Failed to delete post', err);
    } finally {
      setDeletingId(null);
    }
  };

  const sortedBoard = useMemo(() => {
    return [...board].sort((a, b) => {
      if (sortBy === 'votes') return (votes[b.id]?.length ?? 0) - (votes[a.id]?.length ?? 0);
      return b.postedAt - a.postedAt;
    });
  }, [board, sortBy, votes]);

  const resetPostedIndexes = () => setPostedIndexes(new Set());

  return {
    board,
    sortedBoard,
    boardLoading,
    deletingId,
    votes,
    votingId,
    sortBy,
    postingIndex,
    postedIndexes,
    setSortBy,
    loadBoard,
    loadBoardForTab,
    toggleVote,
    postToBoard,
    deletePost,
    resetPostedIndexes,
  };
}
