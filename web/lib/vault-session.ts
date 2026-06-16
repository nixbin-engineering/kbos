// Per-user active vault selection stored in server memory.
// Resets to "main" on restart, which is acceptable.
const activeVaultStore = new Map<string, string>();

export function getActiveVaultId(user: string): string {
  return activeVaultStore.get(user) || "main";
}

export function setActiveVaultId(user: string, vaultId: string): void {
  activeVaultStore.set(user, vaultId);
}
