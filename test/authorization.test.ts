import { describe, expect, it } from "vitest";
import { canDeleteUser } from "../src/authorization.js";

describe("DELETE /users/:id の認可", () => {
  it("denies a user missing from the role map", () => {
    expect(canDeleteUser("user-not-in-cache")).toBe(false);
  });

  it("allows an administrator", () => {
    expect(canDeleteUser("user-42")).toBe(true);
  });
});
