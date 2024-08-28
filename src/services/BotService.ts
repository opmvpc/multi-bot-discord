import { Bot } from "../models/Bots";
import { config, BotConfig } from "../config/config";
import { LLMService } from "./LLMService";
import { DatabaseService } from "./DatabaseService";
import { Conversation } from "../models/Conversation";
import { Memory } from "../models/Memory";
import { ProcessedMessage, LLMResponse } from "../types/index";

export class BotService {
  private bots: Bot[] = [];
  private llmService: LLMService;
  private dbService: DatabaseService;
  private isInitialized: boolean = false;

  constructor(llmService: LLMService, dbService: DatabaseService) {
    this.llmService = llmService;
    this.dbService = dbService;
  }

  public async initializeBots(): Promise<void> {
    if (this.isInitialized) {
      console.log("Bots are already initialized. Skipping initialization.");
      return;
    }

    const initId = Math.random().toString(36).substring(7);
    console.log(`[${initId}] Initializing bots...`);

    for (const botConfig of config.bots) {
      console.log(
        `[${initId}] Initializing bot with token: ${botConfig.token.substr(
          0,
          5
        )}...`
      );
      try {
        const bot = new Bot(botConfig, this.llmService, this.dbService);
        await new Promise<void>((resolve) => {
          bot.getClient().once("ready", () => {
            console.log(
              `[${initId}] Bot initialized: ${bot.getClient().user?.tag}`
            );
            this.setupMessageHandler(bot);
            this.bots.push(bot);
            resolve();
          });
        });
      } catch (error) {
        console.error(`Error initializing bot: ${error}`);
      }
    }

    console.log(`[${initId}] All bots initialized`);
    this.isInitialized = true;
  }

  private setupMessageHandler(bot: Bot): void {
    console.log(
      `[Setup] Starting setupMessageHandler for bot ${bot.getName()}`
    );

    bot.getClient().on("messageCreate", async (message) => {
      console.log(
        `[${new Date().toISOString()}] Received message: ${message.content}`
      );
      console.log(
        `Message author: ${message.author.tag}, Bot: ${bot.getName()}`
      );

      if (message.author.id === bot.getClient().user!.id) {
        console.log("Ignoring own message");
        return;
      }

      if (!message.guild) {
        console.log("Ignoring non-guild message");
        return;
      }

      const isBotMentioned = this.isBotMentioned(
        message.content,
        bot.getName()
      );
      const isFromAnotherBot =
        message.author.bot && message.author.id !== bot.getClient().user!.id;

      console.log("Processing message...");

      try {
        await bot.handleMessage(message);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    console.log(
      `[Setup] Finished setupMessageHandler for bot ${bot.getName()}`
    );
  }

  private isBotMentioned(content: string, botName: string): boolean {
    const mentionRegex = new RegExp(`@${botName}|<@!?\\d+>`, "i");
    return mentionRegex.test(content);
  }
}
