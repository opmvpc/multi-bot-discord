import sqlite3 from 'sqlite3';
import { config } from '../config/config';
import { Conversation, Message } from '../models/Conversation';
import { Memory } from '../models/Memory';

export class DatabaseService {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(config.database.path, (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
      } else {
        console.log("Connected to the SQLite database.");
        this.initializeDatabase();
      }
    });
  }

  private initializeDatabase(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        bot_id TEXT,
        guild_id TEXT,
        channel_id TEXT,
        messages TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT,
        guild_id TEXT,
        channel_id TEXT,
        memories TEXT
      )
    `);
  }

  public async getOrCreateConversation(
    userId: string,
    botId: string,
    guildId: string,
    channelId: string
  ): Promise<Conversation> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM conversations WHERE user_id = ? AND bot_id = ? AND guild_id = ? AND channel_id = ?",
        [userId, botId, guildId, channelId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            const conversation = new Conversation(
              userId,
              botId,
              guildId,
              channelId
            );
            conversation.getMessages().push(...JSON.parse(row.messages));
            resolve(conversation);
          } else {
            const conversation = new Conversation(
              userId,
              botId,
              guildId,
              channelId
            );
            this.saveConversation(conversation)
              .then(() => resolve(conversation))
              .catch(reject);
          }
        }
      );
    });
  }

  public async saveConversation(conversation: Conversation): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR REPLACE INTO conversations (user_id, bot_id, guild_id, channel_id, messages) VALUES (?, ?, ?, ?, ?)",
        [
          conversation.getUserId(),
          conversation.getBotId(),
          conversation.getGuildId(),
          conversation.getChannelId(),
          JSON.stringify(conversation.getMessages()),
        ],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  public async getOrCreateMemory(
    botId: string,
    guildId: string,
    channelId: string
  ): Promise<Memory> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM memories WHERE bot_id = ? AND guild_id = ? AND channel_id = ?",
        [botId, guildId, channelId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            const memory = new Memory(botId, guildId, channelId);
            memory.getMemories().push(...JSON.parse(row.memories));
            resolve(memory);
          } else {
            const memory = new Memory(botId, guildId, channelId);
            this.saveMemory(memory)
              .then(() => resolve(memory))
              .catch(reject);
          }
        }
      );
    });
  }

  public async saveMemory(memory: Memory): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR REPLACE INTO memories (bot_id, guild_id, channel_id, memories) VALUES (?, ?, ?, ?)",
        [
          memory.getBotId(),
          memory.getGuildId(),
          memory.getChannelId(),
          JSON.stringify(memory.getMemories()),
        ],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Méthode pour fermer la connexion à la base de données
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
