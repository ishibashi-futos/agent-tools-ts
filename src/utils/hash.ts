export async function toSha256Hex(input: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(new TextEncoder().encode(input));
  return hasher.digest("hex");
}
