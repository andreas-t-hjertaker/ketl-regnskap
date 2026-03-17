export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
};

export type AssistantContext = {
  user?: { displayName: string | null; email: string | null; uid: string };
  appName: string;
  currentPath: string;
  customContext?: string;
};

export type ChatConfig = {
  modelName?: string;
  systemPrompt?: string;
  contextProvider?: () => AssistantContext;
  welcomeMessage?: string;
  placeholder?: string;
  title?: string;
  position?: "bottom-right" | "bottom-left";
};
