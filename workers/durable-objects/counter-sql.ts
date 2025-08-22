import { DurableObject } from "cloudflare:workers";

/**
 * SQLiteを使用した永続カウンター用Durable Object
 * より複雑なデータ管理とクエリ機能を提供
 */
export class CounterSQL extends DurableObject {
  
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.initializeDatabase();
  }

  /**
   * データベーステーブルを初期化
   */
  private async initializeDatabase() {
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS counter_data (
        id TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // デフォルトカウンターを作成
    await this.ctx.storage.sql.exec(`
      INSERT OR IGNORE INTO counter_data (id, value) 
      VALUES ('default', 0)
    `);
  }

  /**
   * 現在のカウンター値を取得
   * @param counterId カウンターID（デフォルト: 'default'）
   * @returns 現在のカウント値
   */
  async getCounterValue(counterId: string = 'default'): Promise<number> {
    const result = await this.ctx.storage.sql.exec(
      `SELECT value FROM counter_data WHERE id = ?`,
      counterId
    );
    
    const rows = [...result];
    return rows[0]?.[0] as number || 0;
  }

  /**
   * カウンターを増加させる
   * @param amount 増加させる値（デフォルト: 1）
   * @param counterId カウンターID（デフォルト: 'default'）
   * @returns 更新後のカウント値
   */
  async increment(amount: number = 1, counterId: string = 'default'): Promise<number> {
    await this.ctx.storage.sql.exec(`
      UPDATE counter_data 
      SET value = value + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, amount, counterId);
    
    return this.getCounterValue(counterId);
  }

  /**
   * カウンターを減少させる
   * @param amount 減少させる値（デフォルト: 1）
   * @param counterId カウンターID（デフォルト: 'default'）
   * @returns 更新後のカウント値
   */
  async decrement(amount: number = 1, counterId: string = 'default'): Promise<number> {
    await this.ctx.storage.sql.exec(`
      UPDATE counter_data 
      SET value = value - ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, amount, counterId);
    
    return this.getCounterValue(counterId);
  }

  /**
   * カウンターをリセット
   * @param counterId カウンターID（デフォルト: 'default'）
   * @returns リセット後のカウント値（0）
   */
  async reset(counterId: string = 'default'): Promise<number> {
    await this.ctx.storage.sql.exec(`
      UPDATE counter_data 
      SET value = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, counterId);
    
    return 0;
  }

  /**
   * 全カウンターの統計情報を取得
   * @returns カウンター統計配列
   */
  async getAllCounters(): Promise<Array<{
    id: string;
    value: number;
    created_at: string;
    updated_at: string;
  }>> {
    const result = await this.ctx.storage.sql.exec(`
      SELECT id, value, created_at, updated_at 
      FROM counter_data 
      ORDER BY updated_at DESC
    `);
    
    return [...result].map((row: any) => ({
      id: row[0] as string,
      value: row[1] as number,
      created_at: row[2] as string,
      updated_at: row[3] as string
    }));
  }

  /**
   * カウンター履歴を記録（オプション機能）
   */
  async logCounterHistory(counterId: string, oldValue: number, newValue: number, operation: string) {
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS counter_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        counter_id TEXT,
        old_value INTEGER,
        new_value INTEGER,
        operation TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await this.ctx.storage.sql.exec(`
      INSERT INTO counter_history (counter_id, old_value, new_value, operation)
      VALUES (?, ?, ?, ?)
    `, counterId, oldValue, newValue, operation);
  }
}