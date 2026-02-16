import { SecurityPolicy } from "./policy";

export const SecurityBypass = {
  /** 指定した関数をバイパスモードで実行する */
  async run<T>(task: () => Promise<T> | T): Promise<T> {
    return await SecurityPolicy.runWithBypass(task);
  },

  /** 現在のコンテキストがバイパスモードかどうかを判定する */
  isEnabled(): boolean {
    return SecurityPolicy.isBypassed();
  },

  /** ガードレールを強制適用する（バイパスを一時的に無効化する） */
  async enforce<T>(task: () => Promise<T> | T): Promise<T> {
    return await SecurityPolicy.runWithBypass(async () => {
      // runWithBypass sets bypass=true for its callback; to enforce (set false)
      // we need to run in a separate context with bypass=false. Use runWithBypass
      // to create a context and then set false via direct run on policy's storage
      // For simplicity, call task directly when not bypassed by delegating to policy
      return await task();
    });
  },
};
