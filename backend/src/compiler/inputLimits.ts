export const MAX_SOURCE_LENGTH = 1_000_000;

export function assertSourceSize(source: string): void {
  if (typeof source !== "string" || source.length > MAX_SOURCE_LENGTH) {
    throw new Error("Source exceeds the 1 MB compilation limit.");
  }
}