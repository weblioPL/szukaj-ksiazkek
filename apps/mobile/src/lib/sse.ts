/**
 * SSE (Server-Sent Events) streaming helper for React Native
 *
 * Provides a cross-platform way to handle SSE streams
 * using fetch with ReadableStream support.
 */

export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
}

export interface SSEStreamOptions {
  url: string;
  token?: string;
  body?: string;
  onMessage: (message: SSEMessage) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

/**
 * Parse SSE message from raw text
 */
function parseSSEMessage(text: string): SSEMessage | null {
  const lines = text.split('\n');
  const message: SSEMessage = { data: '' };

  for (const line of lines) {
    if (line.startsWith('event:')) {
      message.event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      message.data += line.slice(5).trim();
    } else if (line.startsWith('id:')) {
      message.id = line.slice(3).trim();
    }
  }

  // Only return if we have data
  if (message.data) {
    return message;
  }
  return null;
}

/**
 * Creates an SSE stream connection
 * Returns an abort function to cancel the stream
 */
export function createSSEStream(options: SSEStreamOptions): () => void {
  const { url, token, body, onMessage, onError, onComplete } = options;
  const controller = new AbortController();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Start the fetch request
  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SSE request failed: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const message = parseSSEMessage(buffer);
            if (message) {
              onMessage(message);
            }
          }
          onComplete();
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete messages (separated by double newlines)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const msgText of messages) {
          if (msgText.trim()) {
            const message = parseSSEMessage(msgText);
            if (message) {
              onMessage(message);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled by user
        onComplete();
        return;
      }
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  // Return abort function
  return () => {
    controller.abort();
  };
}

/**
 * Hook-friendly streaming chat message sender
 */
export interface StreamingChatOptions {
  conversationId: string;
  content: string;
  baseUrl: string;
  token?: string;
  onToken: (token: string) => void;
  onComplete: (fullMessage: string, messageId?: string) => void;
  onError: (error: Error) => void;
}

export function streamChatMessage(options: StreamingChatOptions): () => void {
  const { conversationId, content, baseUrl, token, onToken, onComplete, onError } = options;

  let fullMessage = '';
  let messageId: string | undefined;

  const url = `${baseUrl}/conversations/${conversationId}/messages/stream`;

  return createSSEStream({
    url,
    token,
    body: JSON.stringify({ content }),
    onMessage: (message) => {
      try {
        // Try to parse as JSON
        const data = JSON.parse(message.data);

        if (message.event === 'token' || data.type === 'token') {
          const token = data.token || data.content || data.text || '';
          fullMessage += token;
          onToken(token);
        } else if (message.event === 'done' || data.type === 'done' || data.done) {
          messageId = data.messageId || data.id;
          // Don't call onComplete here, let onComplete callback handle it
        } else if (message.event === 'error' || data.type === 'error' || data.error) {
          onError(new Error(data.message || data.error || 'Streaming error'));
        }
      } catch {
        // If not JSON, treat as raw token
        fullMessage += message.data;
        onToken(message.data);
      }
    },
    onError,
    onComplete: () => {
      onComplete(fullMessage, messageId);
    },
  });
}

/**
 * Format time ago in Polish
 */
export function timeAgoPl(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'przed chwilą';
  }
  if (diffMinutes < 60) {
    if (diffMinutes === 1) return '1 minutę temu';
    if (diffMinutes < 5) return `${diffMinutes} minuty temu`;
    return `${diffMinutes} minut temu`;
  }
  if (diffHours < 24) {
    if (diffHours === 1) return '1 godzinę temu';
    if (diffHours < 5) return `${diffHours} godziny temu`;
    return `${diffHours} godzin temu`;
  }
  if (diffDays === 1) {
    return 'wczoraj';
  }
  if (diffDays < 7) {
    return `${diffDays} dni temu`;
  }

  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Extract book IDs from message content
 * Looks for patterns like [ID:uuid] or [BOOK:uuid]
 */
export function parseBookIdsFromText(text: string): string[] {
  const regex = /\[(?:ID|BOOK):([a-f0-9-]{36})\]/gi;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }

  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Remove book ID markers from text for display
 */
export function cleanBookIdsFromText(text: string): string {
  return text.replace(/\[(?:ID|BOOK):([a-f0-9-]{36})\]/gi, '').trim();
}
