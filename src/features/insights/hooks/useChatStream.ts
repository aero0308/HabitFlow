"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * useChatStream — client hook for streaming chat responses.
 *
 * State:
 *   - messages: ChatMessage[] (user + assistant, oldest first)
 *   - conversationId: string | null  (null = brand-new chat)
 *   - isStreaming: boolean
 *   - error: string | null
 *
 * Actions:
 *   - sendMessage(text): creates user message, hits /api/insights/chat/stream,
 *     reads the SSE stream, appends deltas to the assistant message live,
 *     and finalizes when the `done` event arrives.
 *   - abort(): aborts the current stream via AbortController.
 *   - loadConversation(id): fetches a conversation's messages and loads them.
 *   - newConversation(): clears messages, starts a fresh conversation (id null).
 *
 * Auto-scroll: not enforced here — components handle their own scroll logic,
 * but `streamingMessageContentRef` is exposed so the panel can detect the
 * "user is at bottom" condition. (In practice the panel uses a ref to its
 * scroll container.)
 *
 * TypeScript strict — no `any`.
 */

export interface ChatMessage {
  id: string; // client-generated for optimistic user msgs; server-assigned for assistant
  role: "user" | "assistant";
  content: string;
  // For assistant messages: the model + tokensUsed are filled in when the
  // `done` event arrives.
  model?: string;
  tokensUsed?: number | null;
  createdAt: number; // epoch ms — client side
  // True only while streaming — used by the UI to show the streaming cursor
  streaming?: boolean;
  error?: string; // if this assistant message itself errored
}

interface SendResult {
  ok: boolean;
  error?: string;
}

const STORAGE_KEY_CONV = "hf_chat_open_conv_id";

export type ChatMode = "data" | "general";

export function useChatStream(mode: ChatMode = "data") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Use a ref for the assistant message id during streaming so we can
  // mutate just that message in the messages array without stale-state
  // closure issues.
  const streamingMsgIdRef = useRef<string | null>(null);

  // ---------- abort ----------
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    // Mark the streaming message as no longer streaming + remove empty
    // assistant messages that never got a delta.
    setMessages((prev) =>
      prev
        .map((m) =>
          m.id === streamingMsgIdRef.current && m.streaming
            ? {
                ...m,
                streaming: false,
                error: m.content ? undefined : "Cancelled",
              }
            : m,
        )
        .filter((m) => !(m.role === "assistant" && !m.content && !m.error)),
    );
    streamingMsgIdRef.current = null;
  }, []);

  // ---------- cleanup on unmount ----------
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ---------- sendMessage ----------
  const sendMessage = useCallback(
    async (text: string): Promise<SendResult> => {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, error: "Empty message" };
      if (isStreaming) return { ok: false, error: "Already streaming" };

      setError(null);

      // Optimistically add the user message + an empty assistant placeholder
      const userMsgId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const assistantMsgId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      streamingMsgIdRef.current = assistantMsgId;

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsStreaming(true);

      const ac = new AbortController();
      abortControllerRef.current = ac;

      try {
        const res = await fetch("/api/insights/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId ?? undefined,
            message: trimmed,
            mode,
          }),
          signal: ac.signal,
        });

        if (!res.body) {
          throw new Error("No response body");
        }

        // Parse the SSE stream manually.
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let serverMessageId: string | undefined;
        let model: string | undefined;
        let tokensUsed: number | null = null;
        let streamError: string | undefined;

        // Helper to handle one parsed SSE data payload
        const handleEvent = (dataStr: string) => {
          if (!dataStr) return;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            return;
          }
          if (typeof payload.conversationId === "string") {
            setConversationId(payload.conversationId);
            try {
              localStorage.setItem(STORAGE_KEY_CONV, payload.conversationId);
            } catch {
              // ignore — incognito / disabled storage
            }
          }
          if (typeof payload.delta === "string") {
            // Append delta to the streaming assistant message
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + payload.delta }
                  : m,
              ),
            );
          }
          if (payload.done === true) {
            if (typeof payload.messageId === "string") {
              serverMessageId = payload.messageId;
            }
            if (typeof payload.model === "string") {
              model = payload.model;
            }
            if (typeof payload.tokensUsed === "number") {
              tokensUsed = payload.tokensUsed;
            }
          }
          if (typeof payload.error === "string") {
            streamError = payload.error;
          }
        };

        // Read loop
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            // Each SSE event may contain multiple `data:` lines
            for (const line of rawEvent.split("\n")) {
              if (line.startsWith("data:")) {
                handleEvent(line.slice(5).trim());
              }
            }
          }
        }

        // Finalize the streaming message
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            if (streamError) {
              return {
                ...m,
                streaming: false,
                error: streamError,
              };
            }
            return {
              ...m,
              streaming: false,
              // Swap to server-assigned id if we have one (so future history
              // loads don't duplicate it).
              id: serverMessageId ?? m.id,
              model,
              tokensUsed,
            };
          }),
        );

        // Remove an empty assistant message entirely (no deltas arrived)
        setMessages((prev) =>
          prev.filter(
            (m) =>
              m.role !== "assistant" ||
              m.content ||
              m.error ||
              m.id !== assistantMsgId,
          ),
        );

        if (streamError) {
          setError(streamError);
          return { ok: false, error: streamError };
        }

        return { ok: true };
      } catch (e) {
        const err = e as Error & { name?: string };
        if (err.name === "AbortError" || ac.signal.aborted) {
          // User cancelled — already handled in abort()
          return { ok: false, error: "Cancelled" };
        }
        const msg = err.message || "Stream failed";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, streaming: false, error: msg }
              : m,
          ),
        );
        return { ok: false, error: msg };
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        streamingMsgIdRef.current = null;
      }
    },
    [conversationId, isStreaming, mode],
  );

  // ---------- loadConversation ----------
  const loadConversation = useCallback(async (id: string): Promise<SendResult> => {
    // Abort any in-flight stream first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setError(null);

    try {
      const res = await fetch(`/api/insights/chat/conversations/${id}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        const msg = j?.detail ?? `Failed (HTTP ${res.status})`;
        setError(msg);
        return { ok: false, error: msg };
      }
      const json = (await res.json()) as {
        conversation: {
          id: string;
          title: string;
          messages: Array<{
            id: string;
            role: string;
            content: string;
            model?: string | null;
            tokensUsed?: number | null;
            createdAt: string;
          }>;
        };
      };
      setConversationId(json.conversation.id);
      setMessages(
        json.conversation.messages.map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          model: m.model ?? undefined,
          tokensUsed: m.tokensUsed ?? null,
          createdAt: new Date(m.createdAt).getTime(),
        })),
      );
      try {
        localStorage.setItem(STORAGE_KEY_CONV, json.conversation.id);
      } catch {
        // ignore
      }
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // ---------- newConversation ----------
  const newConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setError(null);
    setMessages([]);
    setConversationId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_CONV);
    } catch {
      // ignore
    }
  }, []);

  // ---------- persist / restore conversationId ----------
  // We don't auto-load — the panel triggers loadConversation on mount
  // if there's a saved id. This is to avoid races with the panel's own
  // initialization.

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    sendMessage,
    abort,
    loadConversation,
    newConversation,
  };
}
