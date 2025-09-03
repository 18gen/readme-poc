import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  // ...any callbacks, pages, session, etc
});

// You MUST export both to satisfy all endpoints (session uses GET, _log uses POST)
export const { GET, POST } = handlers;
