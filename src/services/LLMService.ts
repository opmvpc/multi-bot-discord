import axios from "axios";
import { LLMConfig } from "../config/config";
import { Message } from "../models/Conversation";
import { Memory } from "../models/Memory";
import { LLMResponse, ProcessedMessage } from "../types/index";

export class LLMService {
  private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";

  public async shouldRespond(
    llmConfig: LLMConfig,
    messages: ProcessedMessage[]
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        this.API_URL,
        {
          model: llmConfig.model,
          messages: [
            {
              role: "system",
              content:
                'Analyze the conversation and decide if you should respond. Reply with JSON: {"shouldRespond": true/false}',
            },
            ...messages,
          ],
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const decision = JSON.parse(response.data.choices[0].message.content);
      return decision.shouldRespond;
    } catch (error) {
      console.error("Error deciding whether to respond:", error);
      return false;
    }
  }

  public async generateResponse(
    llmConfig: LLMConfig,
    messages: ProcessedMessage[],
    memory: Memory
  ): Promise<LLMResponse> {
    try {
      const response = await axios.post(
        this.API_URL,
        {
          model: llmConfig.model,
          messages: [
            {
              role: "system",
              content: `${llmConfig.systemPrompt}\n\nMemory: ${memory
                .getMemories()
                .join("\n")}`,
            },
            ...messages,
          ],
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const parsedResponse = JSON.parse(
        response.data.choices[0].message.content
      );
      return parsedResponse as LLMResponse;
    } catch (error) {
      console.error("Error generating response:", error);
      return {
        type: "text",
        content:
          "Désolé, j'ai rencontré une erreur lors de la génération de la réponse.",
      };
    }
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
