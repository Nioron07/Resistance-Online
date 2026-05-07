import 'dotenv/config'

import { Authenticator } from "@fastify/passport";

declare module 'fastify' {
  interface PassportUser {
    userid: number;
  }
}

export const passport = new Authenticator();

// Only Store the username as the identifier in the session
passport.registerUserSerializer(async (user: unknown, _req) => {
  return user; // @TODO: Test if this works. This assumes that user.id is what we want as our database uses username as the primary key.
});

// Grab the user information from the db
passport.registerUserDeserializer(async (user: string, _req) => {
  // const user_info = {
  //   username: username,
  // }; // @TODO: Actually replace with the sql call

  return user;
});

// ------------------- ------------------- Register the Passport Strategies for SSO ------------------- ------------------- \\
/**
 * Configures Steam as an IdP
 * 
 * Steam uses OpenID 2
 */
import { Steam } from './passport-strategies/steam.js';
passport.use("steam", Steam);