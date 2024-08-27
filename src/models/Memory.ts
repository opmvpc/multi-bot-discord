export class Memory {
  private memories: string[] = [];

  constructor(
    private botId: string,
    private guildId: string,
    private channelId: string
  ) {}

  public addMemory(memory: string): void {
    this.memories.push(memory);
  }

  public getMemories(): string[] {
    return this.memories;
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
