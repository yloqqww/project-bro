import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      sessionVersion: number;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    role: string;
    name?: string;
    sessionVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    sessionVersion: number;
    revoked?: boolean;
  }
}
