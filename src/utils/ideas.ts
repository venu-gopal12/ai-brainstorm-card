import type { BrainstormIdea } from '../types';

export function parseJsonFromWorker(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);

    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);

    throw new Error('Could not parse AI response');
  }
}

export function normalizeIdeas(value: unknown): BrainstormIdea[] {
  const candidate = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null
      ? Object.values(value).find(Array.isArray)
      : null;

  if (!Array.isArray(candidate)) {
    throw new Error('AI response did not include an ideas list');
  }

  const ideas = candidate
    .map((item) => {
      if (typeof item === 'string') {
        return { title: item, description: '' };
      }
      if (typeof item !== 'object' || item === null) return null;

      const record = item as Record<string, unknown>;
      const title = record.title ?? record.name ?? record.idea;
      const description = record.description ?? record.summary ?? record.details ?? record.desc ?? '';

      if (typeof title !== 'string' || title.trim() === '') return null;
      return {
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() : String(description),
      };
    })
    .filter((idea): idea is BrainstormIdea => idea !== null);

  if (ideas.length === 0) {
    throw new Error('AI response did not include usable ideas');
  }

  return ideas;
}

export function safeNormalizeIdeas(value: unknown): BrainstormIdea[] {
  try {
    return normalizeIdeas(value);
  } catch {
    return [];
  }
}
