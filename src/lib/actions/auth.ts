"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import { text } from "@/lib/form";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = text(formData, "username").trim();
  const password = text(formData, "password");

  if (!username || !password) {
    return { error: "Bitte Benutzername und Passwort eingeben." };
  }

  const limitKey = `login:${username}:${await clientIp()}`;
  if (!(await rateLimit(limitKey))) {
    return {
      error: "Zu viele Versuche. Bitte in 15 Minuten noch einmal probieren.",
    };
  }

  const ok = await login(username, password);
  if (!ok) {
    return { error: "Benutzername oder Passwort ist falsch." };
  }
  resetRateLimit(limitKey).catch((err) =>
    console.error("Rate-Limit-Reset fehlgeschlagen", err),
  );
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}
