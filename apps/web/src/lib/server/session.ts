import {redirect} from '@sveltejs/kit';

export function safeReturnTo(path: string | null = '/tracker') {
  return path?.startsWith('/') && !path.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(path) ? path : '/tracker';
}

export function signInPath(path = '/tracker') {
  return '/signin?returnTo=' + encodeURIComponent(safeReturnTo(path));
}

export async function getUser(locals: App.Locals) {
  if (!process.env.AUTH_SECRET?.trim() && !process.env.NEXTAUTH_SECRET?.trim()) return null;
  const session = await locals.auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    displayName: session.user.name || 'Developer',
    fullName: session.user.name,
    email: session.user.email
  };
}

export async function requireUser(locals: App.Locals, path: string) {
  const user = await getUser(locals);
  if (!user) redirect(303, signInPath(path));
  return user;
}
