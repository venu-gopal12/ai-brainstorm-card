import type { Mode } from '../types';

export const WORKER_URL = 'https://groq-proxy.beereddyvenugopalreddy2.workers.dev';

export const VOTES_FILE = 'votes.json';

export const AVATAR_COLORS = [
  '#e53935',
  '#8e24aa',
  '#1e88e5',
  '#00897b',
  '#f4511e',
  '#3949ab',
  '#00acc1',
];

export const MODES: Mode[] = [
  { id: 'general', label: 'General', emoji: '💡', prompt: 'Generate 5 practical and creative ideas.' },
  { id: 'startup', label: 'Startup', emoji: '🚀', prompt: 'Generate 5 startup business ideas with strong market potential. Focus on solving real problems, scalability, and monetization.' },
  { id: 'technical', label: 'Technical', emoji: '⚙️', prompt: 'Generate 5 technical solution ideas. Focus on architecture, tools, algorithms, or engineering approaches.' },
  { id: 'marketing', label: 'Marketing', emoji: '📣', prompt: 'Generate 5 creative marketing campaign or growth strategy ideas. Focus on audience reach, engagement, and conversion.' },
  { id: 'product', label: 'Product', emoji: '📦', prompt: 'Generate 5 product feature or improvement ideas. Focus on user experience, retention, and solving pain points.' },
  { id: 'life', label: 'Life', emoji: '🌱', prompt: 'Generate 5 thoughtful personal development or life improvement ideas. Focus on habits, wellbeing, and growth.' },
];
