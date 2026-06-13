import { AVATAR_COLORS, MODES } from './constants';
import type { Mode } from '../types';

export function getPlaceholder(modeId: string): string {
  const map: Record<string, string> = {
    startup: 'e.g. a productivity app for students',
    technical: 'e.g. reduce API response time',
    marketing: 'e.g. launch a new fitness brand',
    product: 'e.g. improve user onboarding',
    life: 'e.g. build a morning routine',
  };
  return map[modeId] ?? 'Enter a problem or topic...';
}

export function getInitials(name: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getModeById(id: string): Mode {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}
