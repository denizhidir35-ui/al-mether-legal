import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSING_AUTH_ACCOUNT_MESSAGE,
  createInvitedAppUser,
  verifyAuthUserBeforeActivation,
} from "../lib/adminUserLifecycle.ts";

const input = {
  email: "user@example.com",
  name: "Test User",
  redirectTo: "https://legal.almether.com/auth/set-password",
};

test("invite failure never creates app_users", async () => {
  let appUserCreateCalls = 0;
  let authDeleteCalls = 0;

  const result = await createInvitedAppUser({
    ...input,
    inviteAuthUser: async () => ({
      data: { user: null },
      error: { message: "SMTP failure" },
    }),
    createAppUser: async () => {
      appUserCreateCalls += 1;
      return { data: null, error: null };
    },
    deleteAuthUser: async () => {
      authDeleteCalls += 1;
      return { error: null };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(appUserCreateCalls, 0);
  assert.equal(authDeleteCalls, 0);
});

test("app_users failure rolls back the newly invited Auth user", async () => {
  const deletedAuthUsers = [];

  const result = await createInvitedAppUser({
    ...input,
    inviteAuthUser: async () => ({
      data: {
        user: {
          id: "auth-user-1",
          email: input.email,
        },
      },
      error: null,
    }),
    createAppUser: async () => ({
      data: null,
      error: { message: "insert failed" },
    }),
    deleteAuthUser: async (userId) => {
      deletedAuthUsers.push(userId);
      return { error: null };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.deepEqual(deletedAuthUsers, ["auth-user-1"]);
  assert.equal(result.rollbackError, null);
});

test("a thrown app_users failure still rolls back the Auth user", async () => {
  const deletedAuthUsers = [];

  const result = await createInvitedAppUser({
    ...input,
    inviteAuthUser: async () => ({
      data: {
        user: {
          id: "auth-user-2",
          email: input.email,
        },
      },
      error: null,
    }),
    createAppUser: async () => {
      throw new Error("network failure");
    },
    deleteAuthUser: async (userId) => {
      deletedAuthUsers.push(userId);
      return { error: null };
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(deletedAuthUsers, ["auth-user-2"]);
});

test("normal invite succeeds only after Auth and app_users succeed", async () => {
  const operations = [];

  const result = await createInvitedAppUser({
    ...input,
    inviteAuthUser: async () => {
      operations.push("auth");
      return {
        data: {
          user: {
            id: "auth-user-1",
            email: input.email,
          },
        },
        error: null,
      };
    },
    createAppUser: async () => {
      operations.push("app_users");
      return {
        data: {
          id: "app-user-1",
          email: input.email,
          status: "pending_approval",
        },
        error: null,
      };
    },
    deleteAuthUser: async () => {
      operations.push("rollback");
      return { error: null };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.user.status, "pending_approval");
  assert.deepEqual(operations, ["auth", "app_users"]);
});

test("activation is blocked when the Auth account is missing", async () => {
  const result = await verifyAuthUserBeforeActivation({
    email: input.email,
    status: "active",
    findAuthUser: async () => ({
      user: null,
      error: null,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.error, MISSING_AUTH_ACCOUNT_MESSAGE);
});

test("non-active status changes do not require an Auth lookup", async () => {
  let lookupCalls = 0;

  const result = await verifyAuthUserBeforeActivation({
    email: input.email,
    status: "inactive",
    findAuthUser: async () => {
      lookupCalls += 1;
      return { user: null, error: null };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(lookupCalls, 0);
});
