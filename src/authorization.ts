export type Role = "admin" | "reader";

const rolesByUser: Record<string, readonly Role[]> = {
  "user-42": ["admin"],
  "user-7": ["reader"]
};

export function canDeleteUser(actorId: string): boolean {
  return rolesByUser[actorId]?.includes("admin") ?? false;
}

