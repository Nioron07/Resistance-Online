import 'dotenv/config'
import SteamStrategy from 'passport-steam'
import { DAC } from '../db-queries/DataAccessClass.js';

console.log(`Backend Url: ${process.env.BACKEND_BASE_URL}`);

export const Steam = new SteamStrategy(
  {
    returnURL: `${process.env.BACKEND_BASE_URL!}/auth/login/steam/callback`,
    realm: process.env.BACKEND_BASE_URL!,
    apiKey: process.env.STEAM_WEB_API_KEY!,
    fetchSteamLevel: true, // Defaults to false, makes an extra request to fetch the user's Steam level
    fetchUserProfile: true, // Defaults to true if an API key is provided
  },

  async (identifier: string, profile, done) => {
    try {
      // Grab the userid if there exists a user such that their steamId matches @profile.id
      let userid = await DAC.users.provider('steam').uid(profile.id).getUseridByProviderUID();

      // If it does not exist, then this is a new user logging in. Therefore, create a record for them.
      if (userid === undefined) {
        userid = await DAC.users.create(profile.displayName, profile._json.avatarfull, 'steam', {uid: profile.id, full_object: profile});
      }

      done(null, {userid: userid});
    } catch (err) {
      // done(err) means login failed.
      done(err);
    }
  }
);