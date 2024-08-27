import {
  Client,
  Intents,
  TextChannel,
  Message as DiscordMessage,
} from "discord.js";
import { LLMConfig } from "../config/config";
import { LLMService } from "../services/LLMService";
import { DatabaseService } from "../services/DatabaseService";
import { Conversation } from "./Conversation";
import { Memory } from "./Memory";
import { processMessages } from "../utils/prompts";

export class Bot {
  private client: Client;
  private llmConfig: LLMConfig;
  private llmService: LLMService;
  private dbService: DatabaseService;

  constructor(
    token: string,
    llmConfig: LLMConfig,
    llmService: LLMService,
    dbService: DatabaseService
  ) {
    this.client = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
    });
    this.llmConfig = llmConfig;
    this.llmService = llmService;
    this.dbService = dbService;

    this.client.on("ready", () => {
      console.log(`Bot ${this.client.user?.tag} is ready!`);
    });

    this.client.on("messageCreate", this.handleMessage.bind(this));

    this.client.login(token);
  }

  private async handleMessage(message: DiscordMessage): Promise<void> {
    if (message.author.bot) return;

    const conversation = await this.dbService.getOrCreateConversation(
      message.author.id,
      this.client.user!.id,
      message.guild!.id,
      message.channel.id
    );

    const memory = await this.dbService.getOrCreateMemory(
      this.client.user!.id,
      message.guild!.id,
      message.channel.id
    );

    const recentMessages = await this.getRecentMessages(
      message.channel as TextChannel
    );
    const processedMessages = processMessages(
      recentMessages,
      this.llmConfig.systemPrompt
    );

    const shouldRespond = await this.llmService.shouldRespond(
      this.llmConfig,
      processedMessages
    );

    if (shouldRespond) {
      const response = await this.llmService.generateResponse(
        this.llmConfig,
        processedMessages,
        memory
      );

      if (response.type === "text") {
        message.reply(response.content);
      } else if (response.type === "image") {
        // Implement image sending logic here
      }

      conversation.addMessage({ role: "assistant", content: response.content });
      await this.dbService.saveConversation(conversation);

      if (conversation.getMessages().length > config.maxContextMessages) {
        const outdatedMessages = conversation
          .getMessages()
          .slice(0, -config.maxContextMessages);
        const summary = await this.llmService.summarizeMessages(
          this.llmConfig,
          outdatedMessages
        );
        memory.addMemory(summary);
        await this.dbService.saveMemory(memory);
      }
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

  public getLLMConfig(): LLMConfig {
    return this.llmConfig;
  }

  public getClient(): Client {
    return this.client;
  }
}
