import axios from "axios";
import { LLMConfig } from "../config/config";
import { Message } from "../models/Conversation";
import { Memory } from "../models/Memory";
import { LLMResponse, ProcessedMessage } from "../types/index";
import { z } from "zod";

const LLMResponseSchema = z.object({
  reflection: z.string(),
  shouldRespond: z.boolean(),
  reason: z.string(),
  response: z.string().optional(),
});

type LLMResponseType = z.infer<typeof LLMResponseSchema>;

export class LLMService {
  private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";

  private async callAPI(messages: any[], llmConfig: LLMConfig): Promise<any> {
    try {
      const response = await axios.post(
        this.API_URL,
        {
          model: llmConfig.model,
          messages: messages,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error calling API:", error);
      throw error;
    }
  }

  private cleanApiResponse(response: any): string {
    let content = "";

    if (
      response &&
      response.choices &&
      response.choices[0] &&
      response.choices[0].message
    ) {
      content = response.choices[0].message.content;
    } else {
      console.warn(
        "Unexpected API response structure:",
        JSON.stringify(response)
      );
      return "{}"; // Retourne un objet JSON vide en cas de structure inattendue
    }

    // Essaie d'extraire l'objet JSON de la chaîne de caractères
    const startIndex = content.indexOf("{");
    const endIndex = content.lastIndexOf("}");
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return content.slice(startIndex, endIndex + 1);
    }

    // Si aucun objet JSON n'est trouvé, retourne la chaîne telle quelle
    return content;
  }

  private async getValidatedResponse(
    llmConfig: LLMConfig,
    messages: ProcessedMessage[],
    memory: Memory
  ): Promise<LLMResponseType | null> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let parsedResponse: any = null;
      try {
        const apiResponse = await this.callAPI(messages, llmConfig);
        console.log("API response:", JSON.stringify(apiResponse));

        const cleanedResponse = this.cleanApiResponse(apiResponse);
        console.log("Cleaned API response:", cleanedResponse);

        try {
          parsedResponse = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
          const errorMessage = `Erreur : La réponse n'est pas un JSON valide. Votre réponse DOIT être UNIQUEMENT un objet JSON valide avec la structure spécifiée, sans aucun texte supplémentaire. Réessayez.`;
          messages.push({ role: "assistant", content: cleanedResponse });
          messages.push({ role: "user", content: errorMessage });
          continue;
        }

        const validatedResponse = LLMResponseSchema.parse(parsedResponse);
        return validatedResponse;
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (error instanceof z.ZodError) {
          console.error("Zod validation error:");
          error.errors.forEach((err, index) => {
            console.error(`Error ${index + 1}:`, err.message);
            console.error("Path:", err.path.join("."));
            console.error("Code:", err.code);
          });
          const errorMessage = `Erreur : La réponse ne respecte pas le schéma attendu. Assurez-vous d'inclure tous les champs requis (reflection, shouldRespond, reason, response) et qu'ils sont du bon type. Réessayez avec un JSON valide.`;
          if (parsedResponse !== null) {
            messages.push({
              role: "assistant",
              content: JSON.stringify(parsedResponse),
            });
          }
          messages.push({ role: "user", content: errorMessage });
        } else {
          console.error("Unexpected error:", error);
          return null;
        }
      }
    }
    return null;
  }

  public async processMessage(
    llmConfig: LLMConfig,
    messages: ProcessedMessage[],
    memory: Memory,
    botNames: string[]
  ): Promise<LLMResponse | null> {
    const systemPrompt = `
You are an AI assistant in a multi-bot conversation. Always respond in JSON format and mention other bots using their full mention (e.g., @Llama Bot#0402).

Available bots in this conversation:
${botNames.map(name => `@${name}`).join(', ')}

IMPORTANT:
- The conversation history includes prefixes like "@Bot Name#1234:" before each message. These are added to help you understand the context. DO NOT include these prefixes in your response.
- ALWAYS respond using the following JSON structure:
{
  "reflection": string,
  "shouldRespond": boolean,
  "reason": string,
  "response": string
}
- The "response" field must always be present, even if empty when shouldRespond is false.
- When responding, ALWAYS mention other bots using their full mention (e.g., @Llama Bot#0402) in the "response" field.
- NEVER use plain text responses outside of the JSON structure.
- DO NOT add your own name or mention at the beginning of your response.

Example conversation with different AI assistants:
@GPT-4#1111: {
  "reflection": "The user asked about the latest advancements in quantum computing.",
  "shouldRespond": true,
  "reason": "We should provide information on recent quantum computing developments.",
  "response": "@Claude-3#2222, could you share any recent breakthroughs in quantum computing you're aware of?"
}
@Claude-3#2222: {
  "reflection": "@GPT-4#1111 asked about recent quantum computing breakthroughs.",
  "shouldRespond": true,
  "reason": "I can provide information on recent quantum computing advancements.",
  "response": "@GPT-4#1111, certainly! A recent breakthrough is the development of a 127-qubit quantum computer by IBM, which marks a significant step towards quantum advantage."
}
@GPT-4#1111: {
  "reflection": "@Claude-3#2222 provided information on a recent quantum computing breakthrough.",
  "shouldRespond": true,
  "reason": "I should acknowledge the information and continue the discussion.",
  "response": "Thank you, @Claude-3#2222! That's fascinating. @User#3333, given this advancement, what potential applications of quantum computing are you most excited about?"
}

Memory: ${memory.getMemories().join("\n")}`;

    const systemMessage: ProcessedMessage = {
      role: "system",
      content: systemPrompt,
    };
    const allMessages: ProcessedMessage[] = [systemMessage, ...messages];

    const validatedResponse = await this.getValidatedResponse(
      llmConfig,
      allMessages,
      memory
    );

    if (!validatedResponse) {
      console.error(
        "Failed to obtain a valid response after multiple attempts."
      );
      return {
        type: "text",
        content:
          "I'm sorry, I encountered difficulties formulating an appropriate response. Can you rephrase your question?",
      };
    }

    if (!validatedResponse.shouldRespond) {
      console.log(
        "Decision not to respond. Reason:",
        validatedResponse.reason
      );
      return null;
    }

    return {
      type: "text",
      content:
        validatedResponse.response ||
        "I'm sorry, I don't have an appropriate response at this time.",
    };
  }

  public async summarizeMessages(
    llmConfig: LLMConfig,
    messages: Message[]
  ): Promise<string> {
    try {
      const response = await axios.post(
        this.API_URL,
        {
          model: llmConfig.model,
          messages: [
            {
              role: "system",
              content:
                "Summarize the key points from the following conversation messages. Focus on important information that should be remembered.",
            },
            ...messages,
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("Error summarizing messages:", error);
      return "Erreur lors de la création du résumé.";
    }
  }
}
