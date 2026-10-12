import type {SvelteKitAuthConfig} from '@auth/sveltekit';

export const authCallbacks = {
  async signIn({account, profile}) {
    return account?.provider === 'google' && profile?.email_verified === true;
  },
  async jwt({token, account}) {
    if (account) token.userId = 'google:' + account.providerAccountId;
    return token;
  },
  async session({session, token}) {
    if (session.user) session.user.id = String(token.userId || '');
    return session;
  },
  async redirect({url, baseUrl}) {
    if (!/[\\\u0000-\u0020\u007f]/.test(url) && !url.startsWith('//')) {
      try {
        const target = new URL(url, baseUrl);
        if (target.origin === new URL(baseUrl).origin) return target.href;
      } catch {}
    }
    return baseUrl + '/tracker';
  }
} satisfies NonNullable<SvelteKitAuthConfig['callbacks']>;
