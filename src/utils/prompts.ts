import { Message as DiscordMessage } from "discord.js";
import { ProcessedMessage } from "../types/index";

export function processMessages(
  messages: DiscordMessage[],
  systemPrompt: string
): ProcessedMessage[] {
  const processedMessages: ProcessedMessage[] = [
    { role: "system", content: systemPrompt },
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
        // Vous pouvez ajouter ici la logique pour traiter les images si nécessaire
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
