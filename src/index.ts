import { BotService } from "./services/BotService";
import { LLMService } from "./services/LLMService";
import { DatabaseService } from "./services/DatabaseService";
import { logger } from "./utils/logger";

async function main() {
  try {
    const llmService = new LLMService();
    const dbService = new DatabaseService();
    const botService = new BotService(llmService, dbService);

    await botService.initializeBots();
    logger.info("All bots have been initialized and are running.");

    // Gestion de l'arrêt propre de l'application
    process.on("SIGINT", async () => {
      logger.info("Shutting down...");
      await dbService.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`An error occurred during initialization: ${error}`);
  }
}

main();
