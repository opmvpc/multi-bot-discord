import dotenv from "dotenv";

dotenv.config();

export interface LLMConfig {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  supportsImages: boolean;
  canGenerateImages: boolean;
}

export interface BotConfig {
  token: string;
  name: string;
  discordId: string;
  llm: LLMConfig;
}

export const config = {
  bots: [
    {
      token: process.env.DISCORD_BOT_TOKEN_1 || "",
      name: "Llama Bot",
      discordId: "1277903245678901234", // Remplacez par l'ID réel du bot
      llm: {
        name: "Llama 3.1 8B",
        provider: "openrouter",
        model: "meta-llama/llama-3.1-8b-instruct:free",
        apiKey: process.env.OPENROUTER_API_KEY || "",
        supportsImages: true,
        canGenerateImages: false,
      },
    },
    {
      token: process.env.DISCORD_BOT_TOKEN_2 || "",
      name: "Gemma Bot",
      discordId: "1278123456789012345", // Remplacez par l'ID réel du bot
      llm: {
        name: "Gemma 2 9B",
        provider: "openrouter",
        model: "google/gemma-2-9b-it:free",
        apiKey: process.env.OPENROUTER_API_KEY || "",
        supportsImages: true,
        canGenerateImages: false,
      },
    },
  ] as BotConfig[],
  database: {
    path: process.env.DATABASE_PATH || "./db.sqlite",
  },
  maxContextMessages: 20,
  systemPrompt: `You are a helpful assistant in a Discord server. Always analyze the conversation context and decide if you should respond. If you choose to respond, provide a thoughtful and relevant answer. You can interact with users and other bots. When you see a message from another bot or user, respond to it as if you were having a natural conversation. Be concise and relevant in your responses. You can mention other bots by their names when appropriate.`,
};
