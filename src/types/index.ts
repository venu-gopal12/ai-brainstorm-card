import type { CardUser } from 'dome-embedded-app-sdk';

export interface BrainstormIdea {
  title: string;
  description: string;
}

export interface DrillDown {
  steps: string[];
  risks: string[];
  resources: string[];
}

export interface HistorySession {
  filename: string;
  topic: string;
  mode: string;
  ideas: BrainstormIdea[];
  savedAt: number;
}

export interface BoardPost {
  id: string;
  title: string;
  description: string;
  topic: string;
  mode: string;
  authorId: string;
  authorName: string;
  postedAt: number;
}

export interface VoteData {
  [postId: string]: string[];
}

export type Tab = 'brainstorm' | 'history' | 'board';

export interface Mode {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

export type BoardSort = 'recent' | 'votes';

export interface BoardUserContext {
  user: CardUser;
  myId: string;
}
