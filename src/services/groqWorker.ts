import { WORKER_URL } from '../utils/constants';

export async function callWorker(systemPrompt: string, prompt: string): Promise<string> {
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemPrompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error?.message || response.statusText;
    throw new Error(`API error ${response.status}: ${errorMessage}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
