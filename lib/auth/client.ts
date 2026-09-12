"use client";
import { createAuthClient } from "better-auth/react";

// No baseURL: the app always serves its own /api/auth, so same-origin is always right
// (and keeps working behind a reverse proxy or on a non-default port).
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
