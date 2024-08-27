export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export class Conversation {
  private messages: Message[] = [];

  constructor(
    private userId: string,
    private botId: string,
    private guildId: string,
    private channelId: string
  ) {}

  public addMessage(message: Message): void {
    this.messages.push(message);
  }

  public getMessages(): Message[] {
    return this.messages;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getBotId(): string {
    return this.botId;
  }

  public getGuildId(): string {
    return this.guildId;
  }

  public getChannelId(): string {
    return this.channelId;
  }
}
