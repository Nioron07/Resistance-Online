import 'dotenv/config'
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20'
import { DAC } from '../db-queries/DataAccessClass.js'

/**
 * Google OAuth 2.0 strategy.
 *
 * Mirrors `steam.ts` exactly: lookup-or-create the user via the DAC's
 * provider-keyed `connections` JSONB, then hand a `{ userid }` to passport
 * for serialization. The DAC's `username_set` default of FALSE then sends
 * first-time users through the `/Login/UserNameSignup` confirmation flow.
 */
export const Google = new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL:  `${process.env.BACKEND_BASE_URL!}/auth/login/google/callback`,
    // 'profile' yields displayName + photos, which is everything we use.
    scope: ['profile'],
  },
  async (
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: unknown, user?: { userid: number }) => void,
  ) => {
    try {
      let userid = await DAC.users.provider('google').uid(profile.id).getUseridByProviderUID()
      if (userid === undefined) {
        const username = profile.displayName ?? `User${profile.id.slice(-6)}`
        const pfp      = profile.photos?.[0]?.value ?? ''
        userid = await DAC.users.create(username, pfp, 'google', {
          uid: profile.id,
          full_object: profile as unknown as Record<string, unknown>,
        })
      }
      done(null, { userid })
    } catch (err) {
      done(err)
    }
  },
)
