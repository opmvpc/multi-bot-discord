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
    botNames.map(async (name) => {
      const mention = await Bot.getBotMentionByName(name);
      return `${name} (${mention})`;
    })
  );

  const currentBotMention = await Bot.getBotMentionByName(currentBotName);

  const processedMessages: ProcessedMessage[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\nYou are ${currentBotName} (${currentBotMention}).\nOther bots in the conversation: ${botMentions.join(", ")}\nWhen mentioning other bots, use their full mention string as provided here.`,
    },
  ];

  messages.forEach((message) => {
    const role = message.author.bot ? "assistant" : "user";
    let content = message.content;

    // Add author's name and mention (if bot) at the beginning of the message
    const authorPrefix = message.author.bot
      ? `${message.author.username} (${message.author}): `
      : `${message.author.username}: `;
    content = authorPrefix + content;

    // Handle attachments (images)
    if (message.attachments.size > 0) {
      const imageAttachments = message.attachments.filter((att) =>
        att.contentType?.startsWith("image/")
      );
      if (imageAttachments.size > 0) {
        content += "\n[Image attached]";
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
