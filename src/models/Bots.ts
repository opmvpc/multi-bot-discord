import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Message as DiscordMessage,
} from "discord.js";
import { LLMService } from "../services/LLMService";
import { DatabaseService } from "../services/DatabaseService";
import { Conversation } from "./Conversation";
import { Memory } from "./Memory";
import { processMessages } from "../utils/prompts";
import { LLMConfig, BotConfig, config } from "../config/config";
import { logger } from "../utils/logger";

export class Bot {
  private client: Client;
  private botId: string | null = null;
  private static dbService: DatabaseService;

  constructor(
    private botConfig: BotConfig,
    private llmService: LLMService,
    dbService: DatabaseService
  ) {
    Bot.dbService = dbService;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.once("ready", () => {
      if (this.client.user) {
        this.botId = this.client.user.id;
        this.updateBotName();
        this.saveBotId();
      }
    });

    console.log(
      `Bot token (first 10 characters): ${botConfig.token.substring(0, 10)}...`
    );
    this.client.login(botConfig.token);
  }

  private async saveBotId(): Promise<void> {
    if (this.botId) {
      await Bot.dbService.saveBotId(this.botConfig.name, this.botId);
    }
  }

  public getBotId(): string | null {
    return this.botId;
  }

  public getName(): string {
    return this.botConfig.name;
  }

  public async handleMessage(message: DiscordMessage): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const conversation = await Bot.dbService.getOrCreateConversation(
      message.author.id,
      this.client.user!.id,
      message.guild.id,
      message.channel.id
    );

    const memory = await Bot.dbService.getOrCreateMemory(
      this.client.user!.id,
      message.guild.id,
      message.channel.id
    );

    const recentMessages = await this.getRecentMessages(
      message.channel as TextChannel
    );
    const processedMessages = await processMessages(
      recentMessages,
      config.systemPrompt,
      this.getAllBotNames(),
      this.getName()
    );

    const response = await this.llmService.processMessage(
      this.botConfig.llm,
      processedMessages,
      memory
    );

    // Ajout de la logique d'envoi de message
    if (response && response.content) {
      await message.channel.send(response.content);
    }

    // Mise à jour de la conversation et de la mémoire
    conversation.addMessage({
      role: "assistant",
      content: response?.content || "",
    });
    await Bot.dbService.saveConversation(conversation);

    if (response && response.content) {
      memory.addMemory(response.content);
      await Bot.dbService.saveMemory(memory);
    }
  }

  private async getRecentMessages(
    channel: TextChannel
  ): Promise<DiscordMessage[]> {
    const messages = await channel.messages.fetch({
      limit: config.maxContextMessages,
    });
    return Array.from(messages.values()).reverse();
  }

  private getAllBotNames(): string[] {
    return config.bots.map((bot) => bot.name);
  }

  public getLLMConfig(): LLMConfig {
    return this.botConfig.llm;
  }

  public getClient(): Client {
    return this.client;
  }

  public getMentionString(): string {
    return this.botId ? `<@${this.botId}>` : this.getName();
  }

  public static async getBotMentionByName(name: string): Promise<string> {
    const botId = await Bot.dbService.getBotId(name);
    return botId ? `<@${botId}>` : name;
  }

  private async updateBotName(): Promise<void> {
    if (this.client.user && this.client.user.username !== this.botConfig.name) {
      try {
        await this.client.user.setUsername(this.botConfig.name);
        logger.info(`Bot name updated to ${this.botConfig.name}`);
      } catch (error) {
        logger.error(`Failed to update bot name: ${error}`);
      }
    }
  }
}
