import { resolve, relative, isAbsolute, normalize } from "node:path";

export const SandboxPath = {
  /**
   * 対象パスがワークスペース内にあることを保証し、絶対パスを返す
   * @param targetPath AIから渡されたパス
   * @param root 許可されたルートディレクトリ（絶対パス推奨）
   */
  resolveInWorkspace(targetPath: string, root: string): string {
    const absoluteRoot = resolve(root);
    const absoluteTarget = resolve(absoluteRoot, targetPath);

    // root から target への相対パスを計算
    const rel = relative(absoluteRoot, absoluteTarget);

    // 相対パスが '..' で始まる、またはルートそのものより上の階層（Windowsの別ドライブ等）を指す場合
    const isOutside = rel.startsWith("..") || isAbsolute(rel);

    if (isOutside) {
      throw new Error(
        `[Sandbox Violation] Attempted to access path outside of workspace: "${targetPath}"`,
      );
    }

    return absoluteTarget;
  },

  /**
   * パスが安全かどうかだけを判定する（真偽値）
   */
  isSafe(targetPath: string, root: string): boolean {
    try {
      this.resolveInWorkspace(targetPath, root);
      return true;
    } catch {
      return false;
    }
  },
};
