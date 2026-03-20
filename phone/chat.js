export const MODELS = [
  { id: 'openai/gpt-4o',                        label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini',                   label: 'GPT-4o mini' },
  { id: 'microsoft/Phi-4',                      label: 'Phi-4' },
  { id: 'microsoft/Phi-4-mini-instruct',        label: 'Phi-4 mini' },
  { id: 'mistralai/Mistral-Nemo-Instruct-2407', label: 'Mistral NeMo' },
];

const API = 'https://models.github.ai/inference/chat/completions';

let token = null;
let history = [];
let abortCtrl = null;

export function initChat(ghToken) { token = ghToken; }
export function clearHistory() { history = []; }

export async function send(text, model, { onChunk, onDone, onError }) {
  if (!token) { onError('Not authenticated'); return; }

  history.push({ role: 'user', content: text });
  abortCtrl = new AbortController();

  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: abortCtrl.signal,
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ model, messages: history, max_completion_tokens: 1024, stream: true }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status}: ${body.slice(0, 200)}`);
    }

    let reply = '';
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) { reply += delta; onChunk(delta); }
        } catch {}
      }
    }

    history.push({ role: 'assistant', content: reply });
    onDone();
  } catch (err) {
    if (err.name === 'AbortError') return;
    history.pop();
    onError(err.message);
  }
}

export function abort() { abortCtrl?.abort(); }
