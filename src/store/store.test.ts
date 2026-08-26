import { describe, expect, it } from "bun:test";
import type { AccountUser } from "@/api/auth";
import reducer, { renamed, signedIn, signedOut } from "@/store/authSlice";
import { store } from "@/store";

const user: AccountUser = {
  id: "u1",
  email: "someone@example.com",
  displayName: "Someone",
  createdAt: "2026-08-26T00:00:00Z",
};

describe("the store", () => {
  /*
   * configureStore({ reducer: {} }) throws "Store does not have a valid reducer" the moment
   * the app mounts the Provider, and it shipped that way once. A selector reaching into a
   * slice nobody registered fails the same way, one tab later.
   */
  it("has a reducer, and a state Friends can ask about", () => {
    expect(store.getState().auth.status).toBe("unknown");
  });
});

describe("the auth slice", () => {
  it("starts unknown rather than anonymous", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    expect(state.status).toBe("unknown");
    expect(state.user).toBeNull();
  });

  it("carries the account and the pending first sync in", () => {
    const state = reducer(undefined, signedIn({ user, firstSyncPending: true }));
    expect(state.status).toBe("signedIn");
    expect(state.user).toEqual(user);
    expect(state.firstSyncPending).toBe(true);
  });

  it("goes anonymous, not back to unknown, on sign-out", () => {
    const state = reducer(reducer(undefined, signedIn({ user, firstSyncPending: true })), signedOut());
    expect(state.status).toBe("anonymous");
    expect(state.user).toBeNull();
    expect(state.firstSyncPending).toBe(false);
  });

  it("keeps the session when only the name changed", () => {
    const next = { ...user, displayName: "Someone Else" };
    const state = reducer(reducer(undefined, signedIn({ user, firstSyncPending: false })), renamed(next));
    expect(state.status).toBe("signedIn");
    expect(state.user?.displayName).toBe("Someone Else");
  });
});
