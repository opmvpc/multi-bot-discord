import { Message as DiscordMessage } from "discord.js";
import { ProcessedMessage } from "../types/index";
import { Bot } from "../models/Bots";

export async function processMessages(
  messages: DiscordMessage[],
  systemPrompt: string,
  botNames: string[],
  currentBotName: string
): Promise<ProcessedMessage[]> {
  const botMentions = await Promise.all(
    botNames.map(
      async (name) => `${name} (${await Bot.getBotMentionByName(name)})`
    )
  );
  const processedMessages: ProcessedMessage[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\nYou are ${currentBotName} (${await Bot.getBotMentionByName(
        currentBotName
      )}).\nOther bots in the conversation: ${botMentions.join(
        ", "
      )}\nWhen mentioning other bots, use their full mention string.`,
    },
  ];

  messages.forEach((message) => {
    const role = message.author.bot ? "assistant" : "user";
    let content = message.content;

    // Traitement des pièces jointes (images)
    if (message.attachments.size > 0) {
      const imageAttachments = message.attachments.filter((att) =>
        att.contentType?.startsWith("image/")
      );
      if (imageAttachments.size > 0) {
        content += "\n[Image attachée]";
      }
    }

    processedMessages.push({
      role,
      content,
      author: message.author.username,
      timestamp: message.createdTimestamp,
    });
  });

  return processedMessages;
}
