```
/auth                                   # Authentication
  /login
    `GET` /{for each provider}          # Different endpoint for each provider, not a parameter
      `GET` /callback
  `POST` /logout
  `GET`  /me                            # Essentially and alias for /api/users/{current user's userid}; Query param for full profile and minimal.

/api
  /users
    `GET` /                             # All/subset of users (via array); query param for this and full profile and minimal  
    `GET` /_userid                      # Specific user; Query param for full profile and minimal.
      `GET|PUT` /{sub record}
  ...                                   # non-game async endpoints

/games
  POST /                                # create game room, returns joinCode + wsPath
  GET  /_join_code                      # returns join info

/test-games
    POST /                              # create test game room, returns joinCode + wsPath
    GET  /_join_code                    # returns join info

/ws
  /resistance-games/_join_code
  /test-games/_join_code

/health                                 # Server and Database Health
/ping                                   # Ping/Pong
```