type OperationError = {
  code?: string;
  message?: string;
} | null;

type AuthUser = {
  id: string;
  email?: string | null;
};

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string;
};

type InviteResult = {
  data: { user: AuthUser | null } | null;
  error: OperationError;
};

type CreateAppUserResult = {
  data: AppUser | null;
  error: OperationError;
};

type DeleteAuthUserResult = {
  error: OperationError;
};

export type CreateInvitedAppUserInput = {
  email: string;
  name: string;
  redirectTo: string;
  inviteAuthUser: (
    email: string,
    options: {
      redirectTo: string;
      data: { full_name: string };
    }
  ) => Promise<InviteResult>;
  createAppUser: () => Promise<CreateAppUserResult>;
  deleteAuthUser: (userId: string) => Promise<DeleteAuthUserResult>;
};

export async function createInvitedAppUser({
  email,
  name,
  redirectTo,
  inviteAuthUser,
  createAppUser,
  deleteAuthUser,
}: CreateInvitedAppUserInput) {
  let invited: InviteResult;

  try {
    invited = await inviteAuthUser(email, {
      redirectTo,
      data: {
        full_name: name,
      },
    });
  } catch {
    return {
      ok: false as const,
      status: 502,
      error: "Davet e-postası gönderilemedi.",
      rollbackError: null,
    };
  }

  const authUserId = invited.data?.user?.id;

  if (invited.error || !authUserId) {
    return {
      ok: false as const,
      status: 502,
      error: "Davet e-postası gönderilemedi.",
      rollbackError: null,
    };
  }

  let created: CreateAppUserResult;

  try {
    created = await createAppUser();
  } catch {
    created = {
      data: null,
      error: {
        message: "Kullanıcı oluşturulamadı.",
      },
    };
  }

  if (!created.error && created.data) {
    return {
      ok: true as const,
      status: 201,
      user: created.data,
    };
  }

  let rollbackError: string | null = null;

  try {
    const rolledBack = await deleteAuthUser(authUserId);
    rollbackError = rolledBack.error?.message || null;
  } catch (error) {
    rollbackError =
      error instanceof Error
        ? error.message
        : "Auth rollback başarısız oldu.";
  }

  return {
    ok: false as const,
    status: 500,
    error: "Kullanıcı oluşturulamadı.",
    rollbackError,
  };
}

export const MISSING_AUTH_ACCOUNT_MESSAGE =
  "Bu kullanıcının giriş hesabı oluşturulmamış. Kullanıcıyı yeniden davet edin.";

type FindAuthUserResult = {
  user: AuthUser | null;
  error: string | null;
};

export async function verifyAuthUserBeforeActivation({
  email,
  status,
  findAuthUser,
}: {
  email: string;
  status: string;
  findAuthUser: (email: string) => Promise<FindAuthUserResult>;
}) {
  if (status !== "active") {
    return {
      ok: true as const,
      status: 200,
    };
  }

  let authUser: FindAuthUserResult;

  try {
    authUser = await findAuthUser(email);
  } catch {
    return {
      ok: false as const,
      status: 500,
      error: "Auth kullanıcısı doğrulanamadı.",
    };
  }

  if (authUser.error) {
    return {
      ok: false as const,
      status: 500,
      error: "Auth kullanıcısı doğrulanamadı.",
    };
  }

  if (!authUser.user) {
    return {
      ok: false as const,
      status: 409,
      error: MISSING_AUTH_ACCOUNT_MESSAGE,
    };
  }

  return {
    ok: true as const,
    status: 200,
  };
}
