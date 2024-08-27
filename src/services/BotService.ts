import { Bot } from "../models/Bot";
import { config, BotConfig } from "../config/config";
import { LLMService } from "./LLMService";
import { DatabaseService } from "./DatabaseService";
import { Conversation } from "../models/Conversation";

export class BotService {
  private bots: Bot[] = [];
  private llmService: LLMService;
  private dbService: DatabaseService;

  constructor(llmService: LLMService, dbService: DatabaseService) {
    this.llmService = llmService;
    this.dbService = dbService;
  }

  public async initializeBots(): Promise<void> {
    for (const botConfig of config.bots) {
      const bot = new Bot(botConfig.token, botConfig.llm);
      this.setupMessageHandler(bot);
      this.bots.push(bot);
    }
  }

  private setupMessageHandler(bot: Bot): void {
    bot.getClient().on("messageCreate", async (message) => {
      if (message.author.bot) return;

      const conversation = await this.dbService.getOrCreateConversation(
        message.author.id,
        bot.getClient().user!.id
      );

      conversation.addMessage({ role: "user", content: message.content });

      const response = await this.llmService.generateResponse(
        bot.getLLMConfig(),
        conversation.getMessages()
      );

      conversation.addMessage({ role: "assistant", content: response });
      await this.dbService.saveConversation(conversation);

      message.reply(response);
    });
  }
}
