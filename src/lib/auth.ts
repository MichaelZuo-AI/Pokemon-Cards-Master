import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { BASE_PATH } from '@/lib/paths';

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: `${BASE_PATH}/api/auth`,
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, profile }) {
      if (profile?.sub) {
        token.sub = profile.sub;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
