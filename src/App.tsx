import { useEffect, useState } from 'react'
import {
  CardSdk,
  getKeyFromBlob,
  type CardEventHandler,
  type CardInitData,
  type CardInitErrorPayload,
  type CardKeyBlobV1,
  type CardUser,
  CardFsFileType,
} from 'dome-embedded-app-sdk';
import './App.css'

interface BrainstormIdea {
  title: string;
  description: string;
}

interface DrillDown {
  steps: string[];
  risks: string[];
  resources: string[];
}

interface HistorySession {
  filename: string;
  topic: string;
  mode: string;
  ideas: BrainstormIdea[];
  savedAt: number;
}

interface BoardPost {
  id: string;
  title: string;
  description: string;
  topic: string;
  mode: string;
  authorId: string;
  authorName: string;
  postedAt: number;
}

interface VoteData {
  [postId: string]: string[]; // postId -> array of userIds who voted
}

type Tab = 'brainstorm' | 'history' | 'board';

interface Mode {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

const MODES: Mode[] = [
  { id: 'general',   label: 'General',   emoji: '💡', prompt: 'Generate 5 practical and creative ideas.' },
  { id: 'startup',   label: 'Startup',   emoji: '🚀', prompt: 'Generate 5 startup business ideas with strong market potential. Focus on solving real problems, scalability, and monetization.' },
  { id: 'technical', label: 'Technical', emoji: '⚙️', prompt: 'Generate 5 technical solution ideas. Focus on architecture, tools, algorithms, or engineering approaches.' },
  { id: 'marketing', label: 'Marketing', emoji: '📣', prompt: 'Generate 5 creative marketing campaign or growth strategy ideas. Focus on audience reach, engagement, and conversion.' },
  { id: 'product',   label: 'Product',   emoji: '📦', prompt: 'Generate 5 product feature or improvement ideas. Focus on user experience, retention, and solving pain points.' },
  { id: 'life',      label: 'Life',      emoji: '🌱', prompt: 'Generate 5 thoughtful personal development or life improvement ideas. Focus on habits, wellbeing, and growth.' },
];

function getPlaceholder(modeId: string): string {
  const map: Record<string, string> = {
    startup: 'e.g. a productivity app for students',
    technical: 'e.g. reduce API response time',
    marketing: 'e.g. launch a new fitness brand',
    product: 'e.g. improve user onboarding',
    life: 'e.g. build a morning routine',
  };
  return map[modeId] ?? 'Enter a problem or topic...';
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#e53935','#8e24aa','#1e88e5','#00897b','#f4511e','#3949ab','#00acc1'];
function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const VOTES_FILE = 'votes.json';

function getCardFS(sdk: CardSdk) {
  return {
    list: (folder: string, _shared?: boolean) => {
      return new Promise<any>((resolve, reject) => {
        sdk.cardFS.list(folder, {
          next: (res) => {
            console.log('[CardFS] list raw res:', JSON.stringify(res).slice(0, 200));
            const docs = res.documents || res.files || [];
            const files = docs.map((d: any) => {
              const name = d.name || d;
              // Prepend folder prefix if not already included
              if (folder && folder !== '' && !name.startsWith(folder)) {
                return folder + name;
              }
              return name;
            }).filter(Boolean);
            console.log('[CardFS] list resolved files:', files);
            resolve({ files });
          },
          error: (err: any) => {
            console.log('[CardFS] list error:', err);
            if (err?.code === 'NOT_FOUND' || (err?.message || '').includes('404')) {
              resolve({ files: [] });
            } else {
              reject(err);
            }
          },
        });
      });
    },
    readFile: (name: string, _shared?: boolean) => {
      return new Promise<string>((resolve, reject) => {
        let resolved = false;
        sdk.cardFS.read(name, {
          next: (res) => {
            if (resolved) return;
            // Data arrives as object on first call, undefined on is_complete call
            if (res.data && typeof res.data === 'object') {
              resolved = true;
              resolve(JSON.stringify(res.data));
              return;
            }
            if (typeof res.data === 'string' && res.data.length > 0) {
              resolved = true;
              resolve(res.data);
              return;
            }
            if (res.is_complete && !resolved) {
              reject(new Error('No content received'));
            }
          },
          error: (err) => {
            if (!resolved) reject(err);
          },
        });
      });
    },
    writeFile: (name: string, content: string, _shared?: boolean) => {
      console.log('[CardFS] writing:', name, 'length:', content.length);
      return sdk.cardFS.write(name, content, CardFsFileType.TEXT);
    },
    deleteFile: (name: string, _shared?: boolean) => {
      return sdk.cardFS.delete(name);
    }
  };
}

function App() {
  const [user, setUser]           = useState<CardUser | null>(null);
  const [sdk, setSdk]             = useState<CardSdk | null>(null);
  const [initError, setInitError] = useState<CardInitErrorPayload | null>(null);

  // Generate tab
  const [tab, setTab]                   = useState<Tab>('brainstorm');
  const [topic, setTopic]               = useState('');
  const [selectedMode, setSelectedMode] = useState<Mode>(MODES[0]);
  const [ideas, setIdeas]               = useState<BrainstormIdea[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [hasSearched, setHasSearched]   = useState(false);
  const [savedMsg, setSavedMsg]         = useState('');
  const [copiedIndex, setCopiedIndex]   = useState<number | null>(null);
  const [copiedAll, setCopiedAll]       = useState(false);
  const [postingIndex, setPostingIndex] = useState<number | null>(null);
  const [postedIndexes, setPostedIndexes] = useState<Set<number>>(new Set());

  // Drill-down
  const [drillingIndex, setDrillingIndex]   = useState<number | null>(null);
  const [drillData, setDrillData]           = useState<Record<number, DrillDown>>({});
  const [expandedDrill, setExpandedDrill]   = useState<number | null>(null);

  // History tab
  const [history, setHistory]           = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Board tab
  const [board, setBoard]               = useState<BoardPost[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [votes, setVotes]               = useState<VoteData>({});
  const [votingId, setVotingId]         = useState<string | null>(null);
  const [sortBy, setSortBy]             = useState<'recent' | 'votes'>('votes');

  // ── SDK init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const decBlob = import.meta.env.VITE_CARD_DEC_BLOB;
    if (!decBlob) { setInitError({ message: 'Missing VITE_CARD_DEC_BLOB env variable', error_code: 'MISSING_CARD_DEC_BLOB' }); return; }
    let blob: CardKeyBlobV1;
    try { blob = JSON.parse(decBlob) as CardKeyBlobV1; }
    catch { setInitError({ message: 'Invalid VITE_CARD_DEC_BLOB JSON', error_code: 'INVALID_CARD_DEC_BLOB' }); return; }

    const eventHandler: CardEventHandler = {
      onInit: (data: CardInitData) => {
        const { user, ui } = data;
        user && setUser(user);
        if (ui?.theme) document.documentElement.setAttribute('data-theme', ui.theme);
      },
      onInitError: (data: any) => setInitError(data),
      onError: (data: { message: string; error_code: string | number }) => console.error('Error', data.message),
    };
    CardSdk.init(getKeyFromBlob(blob), eventHandler)
      .then((s) => setSdk(s))
      .catch((err) => console.error('Init failed', err));
  }, []);

  useEffect(() => {
    if (tab === 'history' && sdk) {
      setHistory([]);
      setHistoryLoading(true);
      setTimeout(() => loadHistory(), 400);
    }
    if (tab === 'board' && sdk) {
      setBoard([]);
      setBoardLoading(true);
      setTimeout(() => loadBoard(), 400);
    }
  }, [tab, sdk]);

  // ── History (private) ─────────────────────────────────────────────────────

  const loadHistory = async () => {
    if (!sdk) return;
    setHistoryLoading(true);
    try {
      const fs = getCardFS(sdk);
      const result = await fs.list('history/');
      const files: string[] = result?.files ?? [];
      if (files.length === 0) { setHistory([]); return; }

      // Only load the 10 most recent (already sorted newest-first by CardFS)
      const recentFiles = files.slice(0, 10);

      // Read all in parallel
      const results = await Promise.allSettled(
        recentFiles.map(f => fs.readFile(f))
      );

      const sessions: HistorySession[] = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          try {
            const data = JSON.parse(result.value);
            if (data?.savedAt && data?.topic) {
              sessions.push({ ...data, filename: recentFiles[i] });
            }
          } catch { }
        }
      });

      sessions.sort((a, b) => b.savedAt - a.savedAt);
      setHistory(sessions);
    } catch (err) {
      console.error('[History] load error:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveToHistory = async (topic: string, mode: Mode, ideas: BrainstormIdea[]) => {
    if (!sdk) return;
    const ts = Date.now();
    const filename = `history/session-${ts}.json`;
    const sessionData = { filename, topic, mode: mode.id, ideas, savedAt: ts };

    // Optimistically update UI immediately
    setHistory(prev => [sessionData, ...prev].sort((a, b) => b.savedAt - a.savedAt));
    setSavedMsg('Saved to history ✓');
    setTimeout(() => setSavedMsg(''), 2500);

    // Retry write up to 3 times
    const fs = getCardFS(sdk);
    console.log('[History] Saving file:', filename, 'topic:', topic);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fs.writeFile(filename, JSON.stringify(sessionData));
        console.log('[History] File saved successfully:', filename);
        return;
      } catch (err) {
        console.warn(`History save attempt ${attempt} failed`, err);
        if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
    console.error('History save failed after 3 attempts');
  };

  const deleteSession = async (filename: string) => {
    if (!sdk) return;
    try { await getCardFS(sdk).deleteFile(filename); setHistory(p => p.filter(s => s.filename !== filename)); }
    catch (err) { console.error('Failed to delete', err); }
  };

  // ── Board (shared) ────────────────────────────────────────────────────────

  const loadBoard = async () => {
    if (!sdk) return;
    setBoardLoading(true);
    try {
      const fs = getCardFS(sdk);
      const result = await fs.list('', true);
      const files: string[] = (result?.files ?? []).filter((f: string) =>
        f.startsWith('post-') && f.endsWith('.json')
      );

      // Read all in parallel
      const results = await Promise.allSettled(
        files.map(f => fs.readFile(f, true))
      );

      const posts: BoardPost[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          try { posts.push(JSON.parse(result.value)); } catch { }
        }
      });

      posts.sort((a, b) => b.postedAt - a.postedAt);
      setBoard(posts);
      await loadVotes();
    } catch (err) {
      console.error('Failed to load board', err);
    } finally {
      setBoardLoading(false);
    }
  };

  const loadVotes = async () => {
    if (!sdk) return;
    try {
      const fs = getCardFS(sdk);
      const raw = await fs.readFile(VOTES_FILE, true);
      setVotes(JSON.parse(raw));
    } catch {
      setVotes({});
    }
  };

  const saveVotes = async (updated: VoteData) => {
    if (!sdk) return;
    await getCardFS(sdk).writeFile(VOTES_FILE, JSON.stringify(updated), true);
  };

  const toggleVote = async (postId: string) => {
    if (!sdk || !user) return;
    const myId = user.getId?.() ?? '';
    setVotingId(postId);
    try {
      const current = votes[postId] ?? [];
      const hasVoted = current.includes(myId);
      const updated: VoteData = {
        ...votes,
        [postId]: hasVoted ? current.filter(id => id !== myId) : [...current, myId],
      };
      setVotes(updated);
      await saveVotes(updated);
    } catch (err) { console.error('Vote failed', err); }
    finally { setVotingId(null); }
  };

  const postToBoard = async (idea: BrainstormIdea, index: number) => {
    if (!sdk || !user) return;
    setPostingIndex(index);
    try {
      const fs = getCardFS(sdk);
      const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`;
      const post: BoardPost = {
        id, title: idea.title, description: idea.description,
        topic, mode: selectedMode.id,
        authorId: user.getId?.() ?? 'unknown',
        authorName: user.getFullName?.() ?? 'Anonymous',
        postedAt: Date.now(),
      };
      await fs.writeFile(id, JSON.stringify(post), true);
      setPostedIndexes(p => new Set(p).add(index));
    } catch (err) { console.error('Failed to post', err); }
    finally { setPostingIndex(null); }
  };

  const deletePost = async (post: BoardPost) => {
    if (!sdk || !user) return;
    if (post.authorId !== (user.getId?.() ?? '')) return;
    setDeletingId(post.id);
    try {
      await getCardFS(sdk).deleteFile(post.id, true);
      setBoard(p => p.filter(b => b.id !== post.id));
      const updated = { ...votes };
      delete updated[post.id];
      setVotes(updated);
      await saveVotes(updated);
    } catch (err) { console.error('Failed to delete post', err); }
    finally { setDeletingId(null); }
  };

  // ── Drill-down ────────────────────────────────────────────────────────────

  const drillInto = async (idea: BrainstormIdea, index: number) => {
    if (drillData[index]) {
      setExpandedDrill(expandedDrill === index ? null : index);
      return;
    }
    setDrillingIndex(index);
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) { setDrillingIndex(null); return; }
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are a practical planning assistant. Given an idea, provide a structured breakdown.
Respond ONLY with valid JSON, no markdown, no code fences.
Format: {"steps":["step1","step2","step3"],"risks":["risk1","risk2"],"resources":["resource1","resource2"]}
Keep each item to one short sentence. Exactly 3 steps, 2 risks, 2 resources.`,
            },
            { role: 'user', content: `Idea: "${idea.title}"\nDescription: ${idea.description}\nContext: ${selectedMode.label} mode, topic: ${topic}` },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || response.statusText;
        throw new Error(`API error ${response.status}: ${errorMessage}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      let parsed: DrillDown;
      try { parsed = JSON.parse(content); }
      catch { const match = content.match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : { steps: [], risks: [], resources: [] }; }
      setDrillData(prev => ({ ...prev, [index]: parsed }));
      setExpandedDrill(index);
    } catch (err) { console.error('Drill failed', err); }
    finally { setDrillingIndex(null); }
  };

  // ── Copy / Share ──────────────────────────────────────────────────────────

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
  };

  const copyIdea = async (idea: BrainstormIdea, index: number) => {
    await copyText(`${idea.title}\n${idea.description}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllIdeas = async () => {
    const text = [`💡 Brainstorm: ${topic} (${selectedMode.emoji} ${selectedMode.label})`, '', ...ideas.map((idea, i) => `${i + 1}. ${idea.title}\n   ${idea.description}`)].join('\n');
    await copyText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const shareIdea = async (idea: BrainstormIdea) => {
    const text = `${idea.title}\n${idea.description}`;
    if (navigator.share) { try { await navigator.share({ title: idea.title, text }); return; } catch { } }
    await copyText(text);
  };

  const shareAllIdeas = async () => {
    const text = [`💡 Brainstorm: ${topic} (${selectedMode.emoji} ${selectedMode.label})`, '', ...ideas.map((idea, i) => `${i + 1}. ${idea.title}\n   ${idea.description}`)].join('\n');
    if (navigator.share) { try { await navigator.share({ title: `Brainstorm: ${topic}`, text }); return; } catch { } }
    await copyAllIdeas();
  };

  // ── Brainstorm ────────────────────────────────────────────────────────────

  const brainstorm = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setIdeas([]); setHasSearched(true);
    setCopiedIndex(null); setCopiedAll(false); setPostedIndexes(new Set());
    setDrillData({}); setExpandedDrill(null);

    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) { setError('Groq API key not configured.'); setLoading(false); return; }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: `You are a creative brainstorming assistant. ${selectedMode.prompt}\nRespond ONLY with a valid JSON array, no extra text, no markdown, no code fences.\nFormat: [{"title":"Idea Title","description":"One sentence description."},...]` },
            { role: 'user', content: `Brainstorm ideas for: ${topic}` },
          ],
          temperature: 0.8, max_tokens: 800,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || response.statusText;
        throw new Error(`API error ${response.status}: ${errorMessage}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      let parsed: BrainstormIdea[] = [];
      try { parsed = JSON.parse(content); }
      catch { const match = content.match(/\[[\s\S]*\]/); if (match) parsed = JSON.parse(match[0]); else throw new Error('Could not parse AI response'); }
      setIdeas(parsed);
      await saveToHistory(topic, selectedMode, parsed);
    } catch (err: any) { setError(err.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  const loadSession = (session: HistorySession) => {
    setTopic(session.topic || ''); setIdeas(session.ideas || []); setHasSearched(true);
    setCopiedIndex(null); setCopiedAll(false); setPostedIndexes(new Set());
    setDrillData({}); setExpandedDrill(null);
    const m = MODES.find(m => m.id === session.mode);
    if (m) setSelectedMode(m);
    setTab('brainstorm');
  };

  const reset = () => {
    setTopic(''); setIdeas([]); setHasSearched(false); setError('');
    setCopiedIndex(null); setCopiedAll(false); setPostedIndexes(new Set());
    setDrillData({}); setExpandedDrill(null);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const getModeById = (id: string) => MODES.find(m => m.id === id) ?? MODES[0];

  const sortedBoard = [...board].sort((a, b) => {
    if (sortBy === 'votes') return (votes[b.id]?.length ?? 0) - (votes[a.id]?.length ?? 0);
    return b.postedAt - a.postedAt;
  });

  if (initError) return <div className="main"><div className="error-card"><h3>Initialization Failed</h3><p>{initError.message}</p></div></div>;
  if (!user) return <div className="main"><div className="loading-state"><div className="spinner" /><p>Loading...</p></div></div>;

  const myId = user.getId?.() ?? '';

  return (
    <div className="main">
      <div className="header">
        <div className="header-top">
          <span className="logo">💡</span>
          <div>
            <h1 className="app-title">Brainstorm</h1>
            <p className="app-subtitle">Hi, {user.getFullName?.() ?? 'there'}</p>
          </div>
        </div>
        <div className="tabs">
          <button className={`tab-btn ${tab === 'brainstorm' ? 'active' : ''}`} onClick={() => setTab('brainstorm')}>Generate</button>
          <button className={`tab-btn ${tab === 'board' ? 'active' : ''}`} onClick={() => setTab('board')}>Board</button>
          <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>
      </div>

      {/* ── GENERATE TAB ── */}
      {tab === 'brainstorm' && (
        <>
          <div className="mode-section">
            <p className="mode-label">Mode</p>
            <div className="mode-grid">
              {MODES.map(mode => (
                <button key={mode.id} className={`mode-btn ${selectedMode.id === mode.id ? 'active' : ''}`} onClick={() => { setSelectedMode(mode); reset(); }}>
                  <span className="mode-emoji">{mode.emoji}</span>
                  <span className="mode-name">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-section">
            <input type="text" className="topic-input" placeholder={`${selectedMode.emoji} ${getPlaceholder(selectedMode.id)}`} value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && brainstorm()} disabled={loading} />
            <button className="brainstorm-btn" onClick={brainstorm} disabled={loading || !topic.trim()}>
              {loading ? 'Thinking...' : `Generate ${selectedMode.label} Ideas`}
            </button>
          </div>

          {savedMsg && <div className="saved-msg">{savedMsg}</div>}

          {loading && (
            <div className="thinking">
              <div className="thinking-dots"><span /><span /><span /></div>
              <p>Generating {selectedMode.label.toLowerCase()} ideas for "{topic}"...</p>
            </div>
          )}

          {error && <div className="error-card"><p>⚠️ {error}</p></div>}

          {ideas.length > 0 && (
            <>
              <div className="results-header">
                <p className="results-label">
                  <span className="results-mode-badge">{selectedMode.emoji} {selectedMode.label}</span>&nbsp;· 5 ideas
                </p>
                <div className="results-actions">
                  <button className="icon-action-btn" title="Copy all" onClick={copyAllIdeas}>{copiedAll ? '✓' : '📋'}</button>
                  <button className="icon-action-btn" title="Share all" onClick={shareAllIdeas}>📤</button>
                  <button className="reset-btn" onClick={reset}>New</button>
                </div>
              </div>

              <div className="ideas-list">
                {ideas.map((idea, i) => (
                  <div className="idea-card" key={i}>
                    <div className="idea-number">{i + 1}</div>
                    <div className="idea-content">
                      <h3 className="idea-title">{idea.title}</h3>
                      <p className="idea-desc">{idea.description}</p>

                      <div className="idea-actions">
                        <button className={`idea-action-btn ${copiedIndex === i ? 'copied' : ''}`} onClick={() => copyIdea(idea, i)}>
                          {copiedIndex === i ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button className="idea-action-btn" onClick={() => shareIdea(idea)}>📤 Share</button>
                        <button className={`idea-action-btn ${postedIndexes.has(i) ? 'posted' : ''}`} onClick={() => postToBoard(idea, i)} disabled={postingIndex === i || postedIndexes.has(i)}>
                          {postingIndex === i ? '...' : postedIndexes.has(i) ? '✓ Posted' : '📌 Post'}
                        </button>
                        <button className={`idea-action-btn drill-btn ${expandedDrill === i ? 'drill-open' : ''}`} onClick={() => drillInto(idea, i)} disabled={drillingIndex === i}>
                          {drillingIndex === i ? '⏳' : expandedDrill === i ? '▲ Less' : '🔍 Drill'}
                        </button>
                      </div>

                      {/* Drill-down panel */}
                      {expandedDrill === i && drillData[i] && (
                        <div className="drill-panel">
                          <div className="drill-section">
                            <p className="drill-section-title">✅ Action steps</p>
                            {drillData[i].steps.map((s, j) => <p key={j} className="drill-item">· {s}</p>)}
                          </div>
                          <div className="drill-section">
                            <p className="drill-section-title">⚠️ Risks</p>
                            {drillData[i].risks.map((r, j) => <p key={j} className="drill-item">· {r}</p>)}
                          </div>
                          <div className="drill-section">
                            <p className="drill-section-title">🧰 Resources needed</p>
                            {drillData[i].resources.map((r, j) => <p key={j} className="drill-item">· {r}</p>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {hasSearched && !loading && ideas.length === 0 && !error && (
            <div className="empty-state"><p>No ideas generated. Try a different topic.</p></div>
          )}
        </>
      )}

      {/* ── BOARD TAB ── */}
      {tab === 'board' && (
        <div className="board-section">
          <div className="board-header">
            <p className="board-desc">Ideas shared by dome members</p>
            <div className="board-controls">
              <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as 'recent' | 'votes')}>
                <option value="votes">Top voted</option>
                <option value="recent">Most recent</option>
              </select>
              <button className="refresh-btn" onClick={loadBoard} disabled={boardLoading}>{boardLoading ? '...' : '↻'}</button>
            </div>
          </div>

          {boardLoading && <div className="loading-state"><div className="spinner" /><p>Loading board...</p></div>}

          {!boardLoading && board.length === 0 && (
            <div className="empty-state">
              <p>No ideas posted yet.</p>
              <p style={{ marginTop: 6 }}>Generate ideas and tap 📌 Post to share.</p>
            </div>
          )}

          {!boardLoading && sortedBoard.map((post, rank) => {
            const mode = getModeById(post.mode);
            const isOwn = post.authorId === myId;
            const color = avatarColor(post.authorName);
            const postVotes = votes[post.id] ?? [];
            const hasVoted = postVotes.includes(myId);
            const voteCount = postVotes.length;
            const isTop = sortBy === 'votes' && rank === 0 && voteCount > 0;

            return (
              <div className={`board-card ${isTop ? 'board-card-top-ranked' : ''}`} key={post.id}>
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
                    <button
                      className={`vote-btn ${hasVoted ? 'voted' : ''}`}
                      onClick={() => toggleVote(post.id)}
                      disabled={votingId === post.id}
                    >
                      <span className="vote-icon">▲</span>
                      <span className="vote-count">{voteCount}</span>
                    </button>
                    {isOwn && (
                      <button className="board-delete-btn" onClick={() => deletePost(post)} disabled={deletingId === post.id}>
                        {deletingId === post.id ? '...' : '✕'}
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
          })}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="history-section">
          {historyLoading && <div className="loading-state"><div className="spinner" /><p>Loading history...</p></div>}
          {!historyLoading && history.length === 0 && (
            <div className="empty-state"><p>No saved sessions yet.</p><p style={{ marginTop: 6 }}>Generate ideas and they'll appear here.</p></div>
          )}
          {!historyLoading && history.map(session => {
            const mode = getModeById(session.mode);
            return (
              <div className="history-card" key={session.filename}>
                <div className="history-card-header">
                  <div>
                    <p className="history-topic">"{session.topic}"</p>
                    <p className="history-date"><span className="history-mode-tag">{mode.emoji} {mode.label}</span>&nbsp;· {formatDate(session.savedAt)}</p>
                  </div>
                  <div className="history-actions">
                    <button className="history-load-btn" onClick={() => loadSession(session)}>Load</button>
                    <button className="history-delete-btn" onClick={() => deleteSession(session.filename)}>✕</button>
                  </div>
                </div>
                <div className="history-preview">
                  {(session.ideas || []).slice(0, 2).map((idea, i) => <p key={i} className="history-idea-preview">· {idea.title}</p>)}
                  {(session.ideas || []).length > 2 && <p className="history-more">+{(session.ideas || []).length - 2} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;
