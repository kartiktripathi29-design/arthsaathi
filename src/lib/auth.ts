import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user: supaUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !supaUser) throw new UnauthorizedError();

  const user = await prisma.user.upsert({
    where: { id: supaUser.id },
    update: {},
    create: {
      id: supaUser.id,
      email: supaUser.email ?? `${supaUser.id}@no-email.local`,
    },
  });

  return user;
}

export async function getUser() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
