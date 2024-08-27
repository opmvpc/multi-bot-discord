import dotenv from "dotenv";

dotenv.config();

export interface LLMConfig {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  supportsImages: boolean;
  canGenerateImages: boolean;
  systemPrompt: string;
}

export interface BotConfig {
  token: string;
  llm: LLMConfig;
}

export const config = {
  bots: [
    {
      token: process.env.DISCORD_BOT_TOKEN_1 || "",
      llm: {
        name: "GPT-4",
        provider: "openrouter",
        model: "openai/gpt-4",
        apiKey: process.env.OPENROUTER_API_KEY || "",
        supportsImages: true,
        canGenerateImages: false,
        systemPrompt:
          "You are a helpful assistant in a Discord server. Analyze the conversation context and decide if you should respond. If you choose to respond, provide a thoughtful and relevant answer.",
      },
    },
    // Ajoutez d'autres configurations de bot ici
  ] as BotConfig[],
  database: {
    path: process.env.DATABASE_PATH || "./db.sqlite",
  },
  maxContextMessages: 20,
};
