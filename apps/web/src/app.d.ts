import type {DefaultSession} from '@auth/sveltekit';

declare module '@auth/sveltekit' {
  interface Session {
    user: DefaultSession['user'] & {id: string};
  }
}

declare global {
  namespace App {}
}

export {};
