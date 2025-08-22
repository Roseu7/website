import { DurableObject } from "cloudflare:workers";

/**
 * 永続カウンター用Durable Object
 * 公式ドキュメント: https://developers.cloudflare.com/durable-objects/examples/build-a-counter/
 */
export class Counter extends DurableObject {
  
  /**
   * 現在のカウンター値を取得
   * @returns 現在のカウント値（デフォルト: 0）
   */
  async getCounterValue(): Promise<number> {
    const value = await this.ctx.storage.get("value");
    return (value as number) || 0;
  }

  /**
   * カウンターを増加させる
   * @param amount 増加させる値（デフォルト: 1）
   * @returns 更新後のカウント値
   */
  async increment(amount: number = 1): Promise<number> {
    let value = await this.getCounterValue();
    value += amount;
    await this.ctx.storage.put("value", value);
    await this.updateTimestamp();
    return value;
  }

  /**
   * カウンターを減少させる
   * @param amount 減少させる値（デフォルト: 1）
   * @returns 更新後のカウント値
   */
  async decrement(amount: number = 1): Promise<number> {
    let value = await this.getCounterValue();
    value -= amount;
    await this.ctx.storage.put("value", value);
    await this.updateTimestamp();
    return value;
  }

  /**
   * カウンターをリセット
   * @returns リセット後のカウント値（0）
   */
  async reset(): Promise<number> {
    await this.ctx.storage.put("value", 0);
    await this.updateTimestamp();
    return 0;
  }

  /**
   * カウンターを特定の値に設定
   * @param value 設定したい値
   * @returns 設定後のカウント値
   */
  async setValue(value: number): Promise<number> {
    await this.ctx.storage.put("value", value);
    await this.updateTimestamp();
    return value;
  }

  /**
   * カウンターの統計情報を取得
   * @returns 統計情報オブジェクト
   */
  async getStats(): Promise<{ 
    value: number; 
    lastUpdated: number;
    instanceId: string;
  }> {
    const value = await this.getCounterValue();
    const lastUpdated = await this.ctx.storage.get("lastUpdated") as number || Date.now();
    
    return {
      value,
      lastUpdated,
      instanceId: this.ctx.id.toString()
    };
  }

  /**
   * 最終更新時刻を記録するヘルパーメソッド
   */
  private async updateTimestamp(): Promise<void> {
    await this.ctx.storage.put("lastUpdated", Date.now());
  }
}