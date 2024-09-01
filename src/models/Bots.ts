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
import { ProcessedMessage } from "../types/index"; // Ajoutez cette ligne

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
    if (!message.guild || message.author.id === this.client.user?.id) return;

    // Ajout d'un délai initial aléatoire entre 3 et 5 secondes
    await this.delay(Math.floor(Math.random() * 2000) + 3000);

    console.log(
      `[${new Date().toISOString()}] ${this.getName()} is processing a message.`
    );

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

    const shouldRespond = this.decideIfShouldRespond(message, processedMessages);

    if (shouldRespond) {
      const llmResponse = await this.llmService.processMessage(
        this.getLLMConfig(),
        processedMessages,
        memory,
        this.getAllBotNames()
      );

      if (llmResponse && llmResponse.content) {
        const otherBotName = config.bots.find(
          (bot) => bot.name !== this.getName()
        )?.name;
        if (
          otherBotName &&
          !this.verifyBotMention(llmResponse.content, otherBotName)
        ) {
          console.log(
            `Warning: Bot didn't mention the other bot (${otherBotName}) correctly. Continuing anyway.`
          );
        }

        await message.channel.send(llmResponse.content);

        // Mise à jour de la conversation et de la mémoire
        conversation.addMessage({
          role: "assistant",
          content: llmResponse.content,
        });
        await Bot.dbService.saveConversation(conversation);

        memory.addMemory(llmResponse.content);
        await Bot.dbService.saveMemory(memory);
      } else {
        console.log("Le LLM n'a pas fourni de réponse valide.");
      }
    } else {
      console.log("Le bot a décidé de ne pas répondre.");
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  private verifyBotMention(response: string, otherBotName: string): boolean {
    console.log(
      `Verifying mention of ${otherBotName} in response: ${response}`
    );
    const mentionRegex = new RegExp(`@${otherBotName}|<@!?\\d+>`, "i");
    console.log(`Mention verification result: ${mentionRegex.test(response)}`);
    return mentionRegex.test(response);
  }

  private decideIfShouldRespond(message: DiscordMessage, processedMessages: ProcessedMessage[]): boolean {
    // Si le message mentionne explicitement ce bot, toujours répondre
    if (message.mentions.has(this.client.user!)) return true;

    // Si le message provient d'un utilisateur, toujours répondre
    if (!message.author.bot) return true;

    // Si le message provient d'un autre bot, décider en fonction du contenu
    // Par exemple, répondre si le message pose une question ou mentionne ce bot par son nom
    const content = message.content.toLowerCase();
    return content.includes('?') || content.includes(this.getName().toLowerCase());
  }
}
