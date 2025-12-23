import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000", // or process.env.NEXT_PUBLIC_APP_URL
});

export const { signIn, signOut, useSession } = authClient;
