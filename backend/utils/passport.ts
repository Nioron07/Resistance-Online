import 'dotenv/config'

import { Authenticator } from "@fastify/passport";
import { DAC } from "./db-queries/DataAccessClass.js";

declare module 'fastify' {
  interface PassportUser {
    userid: number;
  }
}

export const passport = new Authenticator();

// Store only the userid in the session — never the whole user object.
passport.registerUserSerializer(async (user: { userid: number }, _req) => {
  return user.userid;
});

// Re-validate against the DB on every session restore so deleted users
// don't keep working sessions. Returning null fails deserialization and
// the request proceeds unauthenticated.
passport.registerUserDeserializer(async (userid: number, _req) => {
  const profile = await DAC.users.id(userid).get(0);
  if (!profile) return null;
  return { userid };
});

// ------------------- ------------------- Register the Passport Strategies for SSO ------------------- ------------------- \\
/**
 * Configures Steam as an IdP
 * 
 * Steam uses OpenID 2
 */
import { Steam } from './passport-strategies/steam.js';
passport.use("steam", Steam);

/**
 * Configures Google as an IdP via OAuth 2.0.
 */
import { Google } from './passport-strategies/google.js';
passport.use("google", Google);