export type FileAccessMode = "read-only" | "workspace-write" | "unrestricted";

export const SandboxFS = {
  /**
   * 実行しようとしている操作が、現在のアクセスモードで許可されているか確認する
   * @param mode 現在のアクセスモード
   * @param isWriteOp 書き込みを伴う操作かどうか
   */
  validateAccess(mode: FileAccessMode, isWriteOp: boolean): void {
    if (isWriteOp && mode === "read-only") {
      throw new Error(
        `[Sandbox Violation] Write operation denied. Current mode: "${mode}"`,
      );
    }
  },
};
