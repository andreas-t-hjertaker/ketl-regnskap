"use client";

import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { app } from "./config";

// Initialiser Firebase AI Logic med Google AI backend
const ai = getAI(app, { backend: new GoogleAIBackend() });

/**
 * Hent en Gemini-modell for generativ AI.
 * Standard: gemini-2.0-flash-lite — rask og billig.
 */
export function getModel(modelName = "gemini-2.0-flash-lite") {
  return getGenerativeModel(ai, { model: modelName });
}

/**
 * Enkel tekst-prompt mot Gemini.
 */
export async function generateText(prompt: string, modelName?: string) {
  const model = getModel(modelName);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Streaming tekst-prompt — gir chunks etter hvert.
 */
export async function* streamText(prompt: string, modelName?: string) {
  const model = getModel(modelName);
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Chat-sesjon med historikk.
 */
export function createChat(
  systemInstruction?: string,
  modelName?: string,
) {
  const model = getModel(modelName);
  return model.startChat({
    history: [],
    ...(systemInstruction && {
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    }),
  });
}

export { ai };
