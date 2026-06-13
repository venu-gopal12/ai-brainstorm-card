import { useState } from 'react';
import { callWorker } from '../services/groqWorker';
import { MODES } from '../utils/constants';
import { normalizeIdeas, parseJsonFromWorker, safeNormalizeIdeas } from '../utils/ideas';
import type { BrainstormIdea, DrillDown, HistorySession, Mode } from '../types';

interface UseBrainstormOptions {
  saveToHistory: (topic: string, mode: Mode, ideas: BrainstormIdea[]) => Promise<void>;
}

export function useBrainstorm({ saveToHistory }: UseBrainstormOptions) {
  const [topic, setTopic] = useState('');
  const [selectedMode, setSelectedMode] = useState<Mode>(MODES[0]);
  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [drillingIndex, setDrillingIndex] = useState<number | null>(null);
  const [drillData, setDrillData] = useState<Record<number, DrillDown>>({});
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);

  const clearResultState = () => {
    setCopiedIndex(null);
    setCopiedAll(false);
    setDrillData({});
    setExpandedDrill(null);
  };

  const reset = () => {
    setTopic('');
    setIdeas([]);
    setHasSearched(false);
    setError('');
    clearResultState();
  };

  const changeMode = (mode: Mode) => {
    setSelectedMode(mode);
    reset();
  };

  const brainstorm = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setIdeas([]);
    setHasSearched(true);
    clearResultState();

    try {
      const content = await callWorker(
        `You are a creative brainstorming assistant. ${selectedMode.prompt}
Respond ONLY with a valid JSON array, no extra text, no markdown, no code fences.
Format: [{"title":"Idea Title","description":"One sentence description."},...]`,
        `Brainstorm ideas for: ${topic}`,
      );

      const parsed = normalizeIdeas(parseJsonFromWorker(content));

      setIdeas(parsed);
      await saveToHistory(topic, selectedMode, parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const drillInto = async (idea: BrainstormIdea, index: number) => {
    if (drillData[index]) {
      setExpandedDrill(expandedDrill === index ? null : index);
      return;
    }

    setDrillingIndex(index);
    try {
      const content = await callWorker(
        `You are a practical planning assistant. Given an idea, provide a structured breakdown.
Respond ONLY with valid JSON, no markdown, no code fences.
Format: {"steps":["step1","step2","step3"],"risks":["risk1","risk2"],"resources":["resource1","resource2"]}
Keep each item to one short sentence. Exactly 3 steps, 2 risks, 2 resources.`,
        `Idea: "${idea.title}"\nDescription: ${idea.description}\nContext: ${selectedMode.label} mode, topic: ${topic}`,
      );

      let parsed: DrillDown;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { steps: [], risks: [], resources: [] };
      }

      setDrillData((prev) => ({ ...prev, [index]: parsed }));
      setExpandedDrill(index);
    } catch (err) {
      console.error('Drill failed', err);
    } finally {
      setDrillingIndex(null);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const copyIdea = async (idea: BrainstormIdea, index: number) => {
    await copyText(`${idea.title}\n${idea.description}`);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatIdeas = () => {
    return [
      `💡 Brainstorm: ${topic} (${selectedMode.emoji} ${selectedMode.label})`,
      '',
      ...ideas.map((idea, index) => `${index + 1}. ${idea.title}\n   ${idea.description}`),
    ].join('\n');
  };

  const copyAllIdeas = async () => {
    await copyText(formatIdeas());
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 2000);
  };

  const shareIdea = async (idea: BrainstormIdea) => {
    const text = `${idea.title}\n${idea.description}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: idea.title, text });
        return;
      } catch {
        // Fall back to copy.
      }
    }
    await copyText(text);
  };

  const shareAllIdeas = async () => {
    const text = formatIdeas();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Brainstorm: ${topic}`, text });
        return;
      } catch {
        // Fall back to copy.
      }
    }
    await copyAllIdeas();
  };

  const loadSession = (session: HistorySession) => {
    setTopic(session.topic || '');
    setIdeas(safeNormalizeIdeas(session.ideas));
    setHasSearched(true);
    clearResultState();
    const mode = MODES.find((candidate) => candidate.id === session.mode);
    if (mode) setSelectedMode(mode);
  };

  return {
    topic,
    selectedMode,
    ideas,
    loading,
    error,
    hasSearched,
    copiedIndex,
    copiedAll,
    drillingIndex,
    drillData,
    expandedDrill,
    setTopic,
    changeMode,
    brainstorm,
    reset,
    drillInto,
    copyIdea,
    copyAllIdeas,
    shareIdea,
    shareAllIdeas,
    loadSession,
  };
}
