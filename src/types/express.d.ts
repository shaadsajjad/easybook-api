// Adds the logged-in user (set by the authenticate middleware) to Express's Request type.
export interface AuthUser {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
