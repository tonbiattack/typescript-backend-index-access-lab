import type { Role } from "../src/authorization.js";

declare const rolesByUser: Record<string, readonly Role[]>;

// @ts-expect-error noUncheckedIndexedAccess有効時、未確認キーの値はundefinedを含む。
rolesByUser["user-not-in-cache"].includes("admin");
