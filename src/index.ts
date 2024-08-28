import { BotService } from "./services/BotService";
import { LLMService } from "./services/LLMService";
import { DatabaseService } from "./services/DatabaseService";

let botService: BotService | null = null;

async function main() {
  console.log("Starting application...");
  try {
    const llmService = new LLMService();
    const dbService = new DatabaseService();

    if (!botService) {
      botService = new BotService(llmService, dbService);
      await botService.initializeBots();
    } else {
      console.log("BotService already initialized. Skipping initialization.");
    }

    console.log("Application is now running.");

    // Gestion de l'arrêt propre de l'application
    process.on("SIGINT", async () => {
      console.log("Shutting down...");
      await dbService.close();
      process.exit(0);
    });
  } catch (error) {
    console.error(`An error occurred during initialization: ${error}`);
  }
}

main();
