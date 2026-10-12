import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
export const {handlers,auth,signIn,signOut}=NextAuth({
 providers:[Google],session:{strategy:'jwt'},pages:{signIn:'/signin'},
 callbacks:{async signIn({account,profile}){return account?.provider==='google'&&(profile as {email_verified?:boolean})?.email_verified===true},async jwt({token,account}){if(account)token.userId='google:'+account.providerAccountId;return token},async session({session,token}){if(session.user)session.user.id=String(token.userId||'');return session}}
});
