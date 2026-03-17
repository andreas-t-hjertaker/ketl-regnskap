"use client";

import { useState, useCallback, useRef } from "react";
import { getModel } from "@/lib/firebase/ai";
import { generateId } from "@/lib/utils";
import { buildSystemPrompt } from "../lib/system-prompt";
import type { ChatMessage, ChatConfig, AssistantContext } from "../types";

type ChatSession = {
  sendMessageStream: (msg: string) => Promise<{
    stream: AsyncIterable<{ text: () => string }>;
  }>;
};

export function useChatSession(
  context: AssistantContext,
  config?: ChatConfig
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatRef = useRef<ChatSession | null>(null);
  const contextRef = useRef(context);

  // Opprett ny chat-sesjon med gjeldende kontekst
  function createSession() {
    const systemPrompt = config?.systemPrompt
      ? config.systemPrompt
      : buildSystemPrompt(context, undefined);

    const model = getModel(config?.modelName);
    const session = model.startChat({
      systemInstruction: {
        role: "system" as const,
        parts: [{ text: systemPrompt }],
      },
    });
    chatRef.current = session as unknown as ChatSession;
    contextRef.current = context;
    return session;
  }

  // Sørg for at vi har en sesjon, opprett ny hvis kontekst har endret seg
  function getSession() {
    if (
      !chatRef.current ||
      contextRef.current.currentPath !== context.currentPath ||
      contextRef.current.user?.uid !== context.user?.uid
    ) {
      return createSession();
    }
    return chatRef.current;
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        const session = getSession();
        const result = await (session as ChatSession).sendMessageStream(
          text.trim()
        );

        let fullText = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullText += chunkText;
            const current = fullText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: current }
                  : m
              )
            );
          }
        }

        // Marker streaming som ferdig
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
      } catch (err) {
        // Ved feil, vis feilmelding som assistentens svar
        const errorMsg =
          err instanceof Error ? err.message : "Ukjent feil oppstod";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Beklager, noe gikk galt: ${errorMsg}`,
                  streaming: false,
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, context]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    chatRef.current = null;
  }, []);

  return { messages, sendMessage, clearMessages, isStreaming };
}
