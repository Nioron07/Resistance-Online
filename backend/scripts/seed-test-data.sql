-- ============================================================================
-- seed-test-data.sql — fake profiles + games + rounds for feature testing
--
-- Creates:
--   * 5 player profiles   (ids 9001..9005, usernames Test*)
--   * 12 finished games   (ids 990001..990012)
--       - 990001 is a fully-detailed 5-round game (nominations, votes,
--         a rejected attempt, mission cards, suspicions) — the showcase
--         for the Replay page + eval bar.
--       - 990002..990012 are single-round games with varied suspicion
--         accuracy and outcomes, so the Profile index-history chart and
--         the leaderboard have real curves.
--   * voting_rounds for every game (inserted in chronological order —
--     round ordering relies on ascending serial ids).
--
-- It does NOT insert player_game_metrics. After running this, run:
--     cd backend && npm run recompute-metrics
-- which rebuilds player_game_metrics from these rounds with the live
-- point catalog — guaranteeing the eval bar, indices, and leaderboard
-- all agree.
--
-- Usage (with the Cloud SQL proxy / local PG running):
--     psql -h localhost -p 5432 -U postgres -d Resistance_Dashboard \
--          -f scripts/seed-test-data.sql
--
-- Re-runnable: it deletes its own id ranges first. The explicit ids sit
-- far above normal serial values so they won't collide with real rows.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- cleanup --
DELETE FROM player_game_metrics WHERE game_id BETWEEN 990001 AND 990012;
DELETE FROM voting_rounds       WHERE game_id BETWEEN 990001 AND 990012;
DELETE FROM games               WHERE id      BETWEEN 990001 AND 990012;
DELETE FROM player_profiles     WHERE id      BETWEEN 9001   AND 9005;

-- --------------------------------------------------------------- profiles --
INSERT INTO player_profiles (id, username, pfp, bio, username_set, connections, last_played)
VALUES
  (9001, 'TestAlice', '', 'Seeded test player',  TRUE, '{"google": {"uid": "test-alice"}}',  NOW()),
  (9002, 'TestBob',   '', 'Seeded test player',  TRUE, '{"google": {"uid": "test-bob"}}',    NOW()),
  (9003, 'TestCarol', '', 'Seeded test player',  TRUE, '{"steam":  {"uid": "test-carol"}}',  NOW()),
  (9004, 'TestDave',  '', 'Sneaky seeded spy',   TRUE, '{"steam":  {"uid": "test-dave"}}',   NOW()),
  (9005, 'TestEve',   '', 'Sneaky seeded spy',   TRUE, '{"google": {"uid": "test-eve"}}',    NOW());

-- ------------------------------------------------------------------ games --
-- players jsonb maps userid -> role. 5-player games: 2 spies each.
INSERT INTO games (id, players, count_failed_votes, mission_statuses, resistance_win, outcome_type, start_timestamp, end_timestamp)
VALUES
  -- Showcase game: 4 missions played (S, F, S, S), one rejected nomination.
  (990001, '{"9001":"resistance","9002":"resistance","9003":"resistance","9004":"spy","9005":"spy"}',
   1, ARRAY[true,false,true,true], TRUE,  'mission-victory',  NOW() - INTERVAL '12 days 40 minutes', NOW() - INTERVAL '12 days'),

  -- History filler games, one detailed round each, spread over ~11 days.
  (990002, '{"9001":"spy","9002":"spy","9003":"resistance","9004":"resistance","9005":"resistance"}',
   0, ARRAY[false], FALSE, 'mission-victory',  NOW() - INTERVAL '11 days 25 minutes', NOW() - INTERVAL '11 days'),
  (990003, '{"9001":"resistance","9002":"spy","9003":"spy","9004":"resistance","9005":"resistance"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '10 days 25 minutes', NOW() - INTERVAL '10 days'),
  (990004, '{"9001":"resistance","9002":"resistance","9003":"spy","9004":"resistance","9005":"spy"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '9 days 25 minutes',  NOW() - INTERVAL '9 days'),
  (990005, '{"9001":"spy","9002":"resistance","9003":"resistance","9004":"spy","9005":"resistance"}',
   0, ARRAY[false], FALSE, 'mission-victory',  NOW() - INTERVAL '8 days 25 minutes',  NOW() - INTERVAL '8 days'),
  (990006, '{"9001":"resistance","9002":"resistance","9003":"resistance","9004":"spy","9005":"spy"}',
   0, ARRAY[false], FALSE, 'mission-victory',  NOW() - INTERVAL '7 days 25 minutes',  NOW() - INTERVAL '7 days'),
  (990007, '{"9001":"resistance","9002":"spy","9003":"resistance","9004":"resistance","9005":"spy"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '6 days 25 minutes',  NOW() - INTERVAL '6 days'),
  (990008, '{"9001":"spy","9002":"resistance","9003":"spy","9004":"resistance","9005":"resistance"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '5 days 25 minutes',  NOW() - INTERVAL '5 days'),
  -- Nomination-limit game: the round is a rejected vote, spies win.
  (990009, '{"9001":"resistance","9002":"resistance","9003":"spy","9004":"spy","9005":"resistance"}',
   5, ARRAY[]::boolean[], FALSE, 'nomination-limit', NOW() - INTERVAL '4 days 25 minutes',  NOW() - INTERVAL '4 days'),
  (990010, '{"9001":"resistance","9002":"spy","9003":"resistance","9004":"spy","9005":"resistance"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '3 days 25 minutes',  NOW() - INTERVAL '3 days'),
  (990011, '{"9001":"spy","9002":"resistance","9003":"resistance","9004":"resistance","9005":"spy"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '2 days 25 minutes',  NOW() - INTERVAL '2 days'),
  (990012, '{"9001":"resistance","9002":"resistance","9003":"resistance","9004":"spy","9005":"spy"}',
   0, ARRAY[true],  TRUE,  'mission-victory',  NOW() - INTERVAL '1 day 25 minutes',   NOW() - INTERVAL '1 day');

-- ---------------------------------------------------------- voting_rounds --
-- NOTE: insertion order matters — replay/metrics order rounds by id ASC.

-- ===== Game 990001 (showcase: resistance 9001-9003, spies 9004/9005) =====
INSERT INTO voting_rounds
  (game_id, leader_userid, mission_participent_userids, count_spies_nominated,
   plot_cards_stuff, vote_poll, vote_status, mission_status, mission_details, suspicions, mission_cards)
VALUES
  -- M1 (size 2): clean team approved, mission SUCCEEDS.
  (990001, '9001', ARRAY['9001','9002'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":true,"9005":false}', TRUE, TRUE, '{}',
   '{"9001":{"9004":2},"9002":{"9005":1},"9003":{"9004":1,"9005":1}}',
   '{"9001":"success","9002":"success"}'),

  -- M2 (size 3): dirty team (9004) approved, mission FAILS.
  (990001, '9002', ARRAY['9002','9003','9004'], 1, NULL,
   '{"9001":false,"9002":true,"9003":true,"9004":true,"9005":true}', TRUE, FALSE, '{}',
   '{"9001":{"9004":4},"9002":{"9004":3},"9003":{"9004":3,"9005":1}}',
   '{"9002":"success","9003":"success","9004":"fail"}'),

  -- M3 (size 2): clean team approved over spy objections, mission SUCCEEDS.
  (990001, '9003', ARRAY['9003','9001'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":false,"9005":false}', TRUE, TRUE, '{}',
   '{"9001":{"9004":4,"9005":2},"9002":{"9004":4},"9003":{"9004":5}}',
   '{"9003":"success","9001":"success"}'),

  -- M4 attempt 1 (size 3): spy leader proposes a dirty team — REJECTED.
  (990001, '9004', ARRAY['9004','9005','9001'], 2, NULL,
   '{"9001":false,"9002":false,"9003":false,"9004":true,"9005":true}', FALSE, NULL, '{}',
   '{"9001":{"9004":5,"9005":3},"9002":{"9004":5,"9005":2},"9003":{"9004":5,"9005":3}}',
   NULL),

  -- M4 attempt 2 (size 3): clean team approved, mission SUCCEEDS → 3-0.
  (990001, '9005', ARRAY['9001','9002','9003'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":false,"9005":false}', TRUE, TRUE, '{}',
   '{"9001":{"9004":5,"9005":4},"9002":{"9004":5,"9005":4},"9003":{"9004":5,"9005":5}}',
   '{"9001":"success","9002":"success","9003":"success"}');

-- ===== Games 990002..990012 (one detailed round each) =====
INSERT INTO voting_rounds
  (game_id, leader_userid, mission_participent_userids, count_spies_nominated,
   plot_cards_stuff, vote_poll, vote_status, mission_status, mission_details, suspicions, mission_cards)
VALUES
  -- 990002: spies 9001/9002 win — infiltrated mission fails. Res suspicion mostly wrong.
  (990002, '9003', ARRAY['9003','9001'], 1, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":true,"9005":false}', TRUE, FALSE, '{}',
   '{"9003":{"9004":2},"9004":{"9001":3},"9005":{"9002":1,"9001":1}}',
   '{"9003":"success","9001":"fail"}'),

  -- 990003: spies 9002/9003 lose — clean mission succeeds. Sharp suspicions.
  (990003, '9001', ARRAY['9001','9004'], 0, NULL,
   '{"9001":true,"9002":false,"9003":true,"9004":true,"9005":true}', TRUE, TRUE, '{}',
   '{"9001":{"9002":4,"9003":3},"9004":{"9002":3},"9005":{"9003":4}}',
   '{"9001":"success","9004":"success"}'),

  -- 990004: spies 9003/9005 lose. Mixed suspicion accuracy.
  (990004, '9002', ARRAY['9002','9001'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":true,"9005":true}', TRUE, TRUE, '{}',
   '{"9001":{"9005":2},"9002":{"9003":3,"9004":1},"9004":{"9005":3}}',
   '{"9002":"success","9001":"success"}'),

  -- 990005: spies 9001/9004 win. 9001 flies under the radar (low RoI hits).
  (990005, '9002', ARRAY['9002','9004'], 1, NULL,
   '{"9001":true,"9002":true,"9003":false,"9004":true,"9005":true}', TRUE, FALSE, '{}',
   '{"9002":{"9004":2},"9003":{"9004":4},"9005":{"9002":2}}',
   '{"9002":"success","9004":"fail"}'),

  -- 990006: spies 9004/9005 win. Resistance saw it coming but got outvoted.
  (990006, '9001', ARRAY['9001','9005'], 1, NULL,
   '{"9001":true,"9002":false,"9003":false,"9004":true,"9005":true}', TRUE, FALSE, '{}',
   '{"9001":{"9005":1},"9002":{"9005":4,"9004":2},"9003":{"9004":3,"9005":3}}',
   '{"9001":"success","9005":"fail"}'),

  -- 990007: spies 9002/9005 lose.
  (990007, '9003', ARRAY['9003','9004'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":true,"9005":false}', TRUE, TRUE, '{}',
   '{"9001":{"9002":3},"9003":{"9005":4},"9004":{"9002":2,"9005":2}}',
   '{"9003":"success","9004":"success"}'),

  -- 990008: spies 9001/9003 lose.
  (990008, '9004', ARRAY['9004','9002'], 0, NULL,
   '{"9001":false,"9002":true,"9003":true,"9004":true,"9005":true}', TRUE, TRUE, '{}',
   '{"9002":{"9001":4},"9004":{"9001":3,"9003":2},"9005":{"9003":3}}',
   '{"9004":"success","9002":"success"}'),

  -- 990009: nomination-limit — the recorded round is a REJECTED dirty team.
  (990009, '9003', ARRAY['9003','9004'], 1, NULL,
   '{"9001":false,"9002":false,"9003":true,"9004":true,"9005":false}', FALSE, NULL, '{}',
   '{"9001":{"9003":3,"9004":3},"9002":{"9004":4},"9005":{"9003":2}}',
   NULL),

  -- 990010: spies 9002/9004 lose.
  (990010, '9005', ARRAY['9005','9001'], 0, NULL,
   '{"9001":true,"9002":false,"9003":true,"9004":false,"9005":true}', TRUE, TRUE, '{}',
   '{"9001":{"9002":3,"9004":3},"9003":{"9004":4},"9005":{"9002":4}}',
   '{"9005":"success","9001":"success"}'),

  -- 990011: spies 9001/9005 lose.
  (990011, '9002', ARRAY['9002','9003'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":true,"9005":true}', TRUE, TRUE, '{}',
   '{"9002":{"9001":2},"9003":{"9001":3,"9005":3},"9004":{"9005":4}}',
   '{"9002":"success","9003":"success"}'),

  -- 990012: spies 9004/9005 lose again — Alice on a hot streak.
  (990012, '9001', ARRAY['9001','9003'], 0, NULL,
   '{"9001":true,"9002":true,"9003":true,"9004":false,"9005":true}', TRUE, TRUE, '{}',
   '{"9001":{"9004":5,"9005":3},"9002":{"9004":4},"9003":{"9005":4}}',
   '{"9001":"success","9003":"success"}');

-- --------------------------------------------- profile counters (derived) --
-- Recompute count_games / count_games_won / game_metrics from the seeded
-- games so profile headers agree with the game data.
UPDATE player_profiles p SET
  count_games     = s.games,
  count_games_won = s.wins,
  game_metrics    = s.game_metrics,
  last_played     = s.last_played
FROM (
  SELECT e.key::bigint AS userid,
         COUNT(*)      AS games,
         COUNT(*) FILTER (
           WHERE (e.value IN ('spy','assassin','false-commander','deep-cover','blind-spy')) <> g.resistance_win
         ) AS wins,
         jsonb_object_agg(
           g.id::text,
           (e.value IN ('spy','assassin','false-commander','deep-cover','blind-spy')) <> g.resistance_win
         ) AS game_metrics,
         MAX(g.end_timestamp) AS last_played
  FROM games g
  CROSS JOIN LATERAL jsonb_each_text(g.players) AS e(key, value)
  WHERE g.id BETWEEN 990001 AND 990012
  GROUP BY e.key
) s
WHERE p.id = s.userid;

COMMIT;

-- ============================================================================
-- NEXT STEP (required): populate player_game_metrics from these rounds:
--     cd backend && npm run recompute-metrics
-- (or scope it:  npm run recompute-metrics -- 990001 990002 ... 990012)
--
-- Then check:
--   * /Game/990001/Replay      → eval bar swinging spy-ward after the M2
--                                fail, then back as resistance closes it out
--   * /Profile/TestAlice       → index-history line chart (12 games)
--   * /Leaderboard             → Test* players ranked by P/R/S index
--   * /Search                  → filter outcome "Nomination Limit" → 990009
-- ============================================================================
