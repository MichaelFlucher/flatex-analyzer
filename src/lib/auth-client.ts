import { createAuthClient } from "better-auth/react";

// Infer the concrete empty options type; omitting it widens Better Auth 1.6 client
// options and makes useSession().data resolve to never in this non-strict project.
export const { signIn, signUp, signOut, useSession, deleteUser } = createAuthClient({});
