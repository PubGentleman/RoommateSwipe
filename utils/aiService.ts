import { supabase } from '../lib/supabase';
import type { DailyQuestion } from '../types/models';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export async function getDailyQuestion(): Promise<DailyQuestion | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/generate-daily-question`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;
    const { question } = await response.json();
    return question;
  } catch (error) {
    console.error('[getDailyQuestion] error:', error);
    return null;
  }
}

export async function answerDailyQuestion(questionId: string, selectedValue: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/answer-daily-question`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionId, selectedValue }),
      }
    );

    if (!response.ok) return false;
    const { success } = await response.json();
    return success;
  } catch (error) {
    console.error('[answerDailyQuestion] error:', error);
    return false;
  }
}

export interface AIServiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface AIResponse {
  reply: string;
  remainingMessages: number;
  plan: string;
}

export const createSessionId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export async function sendAIMessage(
  message: string,
  sessionId: string,
  onChunk?: (text: string) => void,
  onComplete?: (remainingMessages: number, plan: string) => void,
): Promise<AIResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${supabaseUrl}/functions/v1/ai-assistant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message, sessionId }),
    }
  );

  if (!response.ok) {
    if (onChunk) {
      onChunk("I'm having a bit of trouble connecting right now. Try sending your message again in a moment.");
      onComplete?.(0, 'unknown');
      return { reply: "I'm having a bit of trouble connecting right now. Try sending your message again in a moment.", remainingMessages: 0, plan: 'unknown' };
    }
    const errBody = await response.text().catch(() => '');
    throw new Error(errBody || 'AI request failed');
  }

  const contentType = response.headers.get('content-type') || '';
  const isStreaming = contentType.includes('text/event-stream');

  if (!isStreaming || !onChunk) {
    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data as AIResponse;
  }

  let fullReply = '';
  let remaining = 0;
  let planResult = 'free';

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.delta) {
            fullReply += data.delta;
            onChunk(data.delta);
          }
          if (data.done) {
            remaining = data.remainingMessages ?? 0;
            planResult = data.plan ?? 'free';
            onComplete?.(remaining, planResult);
          }
        } catch {}
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.delta) {
          fullReply += data.delta;
          onChunk(data.delta);
        }
        if (data.done) {
          remaining = data.remainingMessages ?? 0;
          planResult = data.plan ?? 'free';
          onComplete?.(remaining, planResult);
        }
      } catch {}
    }
  } else {
    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.delta) {
          fullReply += data.delta;
          onChunk(data.delta);
        }
        if (data.done) {
          remaining = data.remainingMessages ?? 0;
          planResult = data.plan ?? 'free';
          onComplete?.(remaining, planResult);
        }
      } catch {}
    }
  }

  return { reply: fullReply, remainingMessages: remaining, plan: planResult };
}

export async function loadConversationHistory(sessionId: string): Promise<AIServiceMessage[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) return [];

  return (data ?? []).map(row => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at),
  }));
}
