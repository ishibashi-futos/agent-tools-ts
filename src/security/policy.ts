import { AsyncLocalStorage } from "node:async_hooks";

// ツールごとのアクセス権限レベル
export type AccessLevel = 'allow' | 'deny';

export interface SecurityPolicyConfig {
  tools: Record<string, AccessLevel>;
  defaultPolicy: AccessLevel;
}

// バイパス状態を管理するストレージ
const bypassStorage = new AsyncLocalStorage<boolean>();

export const SecurityPolicy = {
  /**
   * 指定されたコンテキスト内でのみ、セキュリティチェックを無効化する
   */
  async runWithBypass<T>(task: () => Promise<T> | T): Promise<T> {
    return await bypassStorage.run(true, async () => {
      return await task();
    });
  },

  /**
   * 現在のコンテキストがバイパスモードかどうかを確認
   */
  isBypassed(): boolean {
    return bypassStorage.getStore() ?? false;
  },

  /**
   * ツールの実行が許可されているか判定する
   * @throws 拒否設定されている場合にエラーを投げる
   */
  authorize(toolName: string, config: SecurityPolicyConfig): void {
    if (this.isBypassed()) return;

    const policy = config.tools[toolName] ?? config.defaultPolicy;

    if (policy === 'deny') {
      throw new Error(`[Security Policy] Access denied for tool: "${toolName}"`);
    }

  }
};
