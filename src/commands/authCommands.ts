import { AuthManager } from "../auth/AuthManager";

export async function loginOAuth(auth: AuthManager) {
  return await auth.authenticateWithOAuth();
}

export async function loginEnv(auth: AuthManager) {
  return await auth.getValidToken();
}

export async function logout(auth: AuthManager) {
  await auth.logout();
  return { ok: true };
}