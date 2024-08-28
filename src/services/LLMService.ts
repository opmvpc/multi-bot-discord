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

  private cleanLLMResponse(response: string): string {
    // Retire les backticks et les indicateurs de langage JSON
    let cleaned = response.replace(/```json\s*|\s*```/g, "");

    // Retire les commentaires potentiels
    cleaned = cleaned
      .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1")
      .trim();

    return cleaned;
  }

  private cleanApiResponse(response: any): string {
    let content = '';

    if (response && response.choices && response.choices[0] && response.choices[0].message) {
      content = response.choices[0].message.content;
    } else if (typeof response === 'string') {
      content = response;
    } else {
      console.warn('Unexpected API response structure:', JSON.stringify(response));
      return '{}'; // Retourne un objet JSON vide en cas de structure inattendue
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
      try {
        const apiResponse = await this.callAPI(messages, llmConfig);
        console.log("API response:", JSON.stringify(apiResponse));

        const cleanedResponse = this.cleanApiResponse(apiResponse);
        console.log("Cleaned API response:", cleanedResponse);

        let parsedResponse;
        try {
          parsedResponse = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
          parsedResponse = {
            reflection: cleanedResponse,
            shouldRespond: true,
            reason: "Direct response",
            response: cleanedResponse,
          };
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
          const errorMessage = `Erreur de validation JSON. Veuillez corriger : ${error.errors
            .map((e) => e.message)
            .join(", ")}`;
          messages.push({ role: "user", content: errorMessage });
        } else {
          console.error("Unexpected error:", error);
          return null;
        }
      }
    }
    console.error(
      "Failed to get a valid response after",
      maxAttempts,
      "attempts"
    );
    return null;
  }

  public async processMessage(
    llmConfig: LLMConfig,
    messages: ProcessedMessage[],
    memory: Memory
  ): Promise<LLMResponse | null> {
    const systemPrompt = `
Vous êtes un assistant IA analysant des conversations en français. Suivez ces étapes :
1. Réfléchissez à la conversation et au dernier message.
2. Décidez si une réponse est nécessaire.
3. Si une réponse est nécessaire, formulez-en une en français.

Votre réponse DOIT être un objet JSON valide avec la structure suivante :
{
  "reflection": string,
  "shouldRespond": boolean,
  "reason": string,
  "response": string (seulement si shouldRespond est true)
}
N'incluez aucun texte en dehors de l'objet JSON.

Mémoire : ${memory.getMemories().join("\n")}`;

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
        "Échec de l'obtention d'une réponse valide après plusieurs tentatives."
      );
      return {
        type: "text",
        content:
          "Je suis désolé, j'ai rencontré des difficultés à formuler une réponse appropriée. Pouvez-vous reformuler votre question ?",
      };
    }

    if (!validatedResponse.shouldRespond) {
      console.log(
        "Décision de ne pas répondre. Raison :",
        validatedResponse.reason
      );
      return null;
    }

    return {
      type: "text",
      content:
        validatedResponse.response ||
        "Je suis désolé, je n'ai pas de réponse appropriée à ce moment.",
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
