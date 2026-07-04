<template>
  <v-container class="r-replay" max-width="1100">
    <!-- Loading state -->
    <div v-if="loading" class="r-loading">
      <v-progress-circular color="primary" indeterminate size="42" width="3" />
      <span class="r-loading-text">Loading game replay…</span>
    </div>

    <template v-else-if="data">
      <!-- Header -->
      <header class="r-replay-header">
        <div>
          <h1 class="r-replay-title">REPLAY · GAME #{{ data.gameid }}</h1>

          <p v-if="data.endTimestamp" class="r-replay-sub">
            Ended {{ formatDate(data.endTimestamp) }}
          </p>
        </div>

        <MissionTracker :outcomes="data.outcome.missionStatuses" :player-count="data.players.length" />
      </header>

      <!-- Timeline strip -->
      <div class="r-timeline-wrap">
        <div class="r-timeline">
          <button
            v-for="(step, i) in steps"
            :key="i"
            class="r-tick"
            :class="tickClass(step, i)"
            :title="step.label"
            type="button"
            @click="currentIndex = i"
          />
        </div>

        <div class="r-timeline-meta tabular-nums">
          STEP {{ currentIndex + 1 }} / {{ steps.length }}
        </div>
      </div>

      <!-- Eval bar: cumulative team point differential up to the current step -->
      <div v-if="data.evalSeries && data.evalSeries.length > 0" class="r-eval-wrap">
        <EvalBar :differential="currentEval" :max-abs="evalMaxAbs" />
      </div>

      <!-- Step card -->
      <article v-if="currentStep" class="r-step-card" :class="`r-step-${currentStep.kind}`">
        <header class="r-step-header">
          <span class="r-step-eyebrow">{{ currentStep.eyebrow }}</span>
          <h2 class="r-step-title">{{ currentStep.title }}</h2>
        </header>

        <!-- IDENTITY -->
        <div v-if="currentStep.kind === 'identity'" class="r-identity-grid">
          <section>
            <h3 class="r-side-title r-side-title-resistance">RESISTANCE</h3>

            <ul class="r-player-list">
              <li v-for="p in resistancePlayers" :key="p.userid">
                <PlayerCell :avatar="p.pfp" :role="p.role" :username="p.username ?? `#${p.userid}`" />
              </li>
            </ul>
          </section>

          <section>
            <h3 class="r-side-title r-side-title-spy">SPY</h3>

            <ul class="r-player-list">
              <li v-for="p in spyPlayers" :key="p.userid">
                <PlayerCell :avatar="p.pfp" :role="p.role" :username="p.username ?? `#${p.userid}`" />
              </li>
            </ul>
          </section>
        </div>

        <!-- NOMINATION -->
        <div v-else-if="currentStep.kind === 'nomination'" class="r-nom">
          <div class="r-nom-leader">
            <span class="r-nom-label">LEADER</span>

            <PlayerCell
              v-if="currentStep.round.leaderUserid !== null"
              :avatar="playerByUserid[currentStep.round.leaderUserid]?.pfp"
              :role="playerByUserid[currentStep.round.leaderUserid]?.role"
              :username="playerByUserid[currentStep.round.leaderUserid]?.username ?? `#${currentStep.round.leaderUserid}`"
            />

            <span v-else>—</span>
          </div>

          <div class="r-nom-team">
            <span class="r-nom-label">PROPOSED TEAM</span>

            <ul class="r-player-list">
              <li v-for="id in currentStep.round.team" :key="id">
                <PlayerCell
                  :avatar="playerByUserid[id]?.pfp"
                  :role="playerByUserid[id]?.role"
                  :username="playerByUserid[id]?.username ?? `#${id}`"
                />
              </li>
            </ul>
          </div>
        </div>

        <!-- VOTE -->
        <div v-else-if="currentStep.kind === 'vote'" class="r-vote">
          <div class="r-vote-result-row">
            <span class="r-vote-result-label">RESULT</span>

            <span class="r-vote-result-chip" :class="currentStep.round.voteStatus === true ? 'r-vote-chip-yes' : currentStep.round.voteStatus === false ? 'r-vote-chip-no' : ''">
              {{ currentStep.round.voteStatus === true ? 'APPROVED' : currentStep.round.voteStatus === false ? 'REJECTED' : '—' }}
            </span>

            <span class="r-vote-result-counts text-medium-emphasis tabular-nums">
              {{ voteCount(currentStep.round.votePoll, true) }} ✓ · {{ voteCount(currentStep.round.votePoll, false) }} ✗
            </span>
          </div>

          <div v-if="currentStep.round.votePoll" class="r-ballot-grid">
            <div
              v-for="p in data.players"
              :key="p.userid"
              class="r-ballot"
              :class="ballotClass(currentStep.round.votePoll, p.userid)"
            >
              <PlayerCell :avatar="p.pfp" :role="p.role" :username="p.username ?? `#${p.userid}`" />

              <span class="r-ballot-mark">
                {{ ballotMark(currentStep.round.votePoll, p.userid) }}
              </span>
            </div>
          </div>

          <div v-else class="r-empty-hint">Per-player ballot data not recorded for this game.</div>
        </div>

        <!-- MISSION -->
        <div v-else-if="currentStep.kind === 'mission'" class="r-mission">
          <div class="r-mission-result-row">
            <span class="r-mission-result-label">MISSION RESULT</span>

            <span class="r-mission-result-chip" :class="currentStep.round.missionStatus === true ? 'r-mission-chip-success' : currentStep.round.missionStatus === false ? 'r-mission-chip-fail' : ''">
              {{ currentStep.round.missionStatus === true ? 'SUCCESS' : currentStep.round.missionStatus === false ? 'FAIL' : '—' }}
            </span>

            <span class="r-mission-result-counts text-medium-emphasis tabular-nums">
              {{ cardCount(currentStep.round.missionCards, 'success') }} ✓ · {{ cardCount(currentStep.round.missionCards, 'fail') }} ✗
            </span>
          </div>

          <div v-if="currentStep.round.missionCards" class="r-cards-grid">
            <div
              v-for="id in currentStep.round.team"
              :key="id"
              class="r-card-cell"
              :class="cardCellClass(currentStep.round.missionCards, id)"
            >
              <PlayerCell
                :avatar="playerByUserid[id]?.pfp"
                :role="playerByUserid[id]?.role"
                :username="playerByUserid[id]?.username ?? `#${id}`"
              />

              <span class="r-card-mark">
                {{ cardMark(currentStep.round.missionCards, id) }}
              </span>
            </div>
          </div>

          <div v-else class="r-empty-hint">Per-player mission cards not recorded for this game.</div>
        </div>

        <!-- SUSPICION -->
        <div v-else-if="currentStep.kind === 'suspicion'" class="r-suspicion">
          <p class="r-suspicion-hint text-medium-emphasis">
            Each row is a resistance player's submitted suspicions. Cells show
            confidence γ (1 = mild, 5 = certain).
          </p>

          <!-- Scrolls horizontally inside the card — an 8-10 player grid is
               wider than a phone viewport. -->
          <div class="r-suspicion-scroll">
            <table class="r-suspicion-grid tabular-nums">
              <thead>
              <tr>
                <th />

                <th v-for="t in data.players" :key="`th-${t.userid}`" :title="t.username ?? `#${t.userid}`">
                  {{ (t.username ?? `#${t.userid}`).slice(0, 6) }}
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="voterid in suspicionVoters(currentStep.round.suspicions)" :key="voterid">
                <th class="r-sus-row-label">{{ playerByUserid[Number(voterid)]?.username ?? `#${voterid}` }}</th>

                <td
                  v-for="t in data.players"
                  :key="`${voterid}-${t.userid}`"
                  class="r-sus-cell"
                  :class="suspicionCellClass(currentStep.round.suspicions, voterid, t.userid)"
                >
                  {{ suspicionCellText(currentStep.round.suspicions, voterid, t.userid) }}
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- OUTCOME -->
        <div v-else-if="currentStep.kind === 'outcome'" class="r-outcome">
          <GameOutcomeChip
            :reason="formatOutcomeType(data.outcome.outcomeType)"
            :winner="data.outcome.winner"
          />

          <MissionTracker :outcomes="data.outcome.missionStatuses" :player-count="data.players.length" />

          <v-btn
            class="mt-4"
            color="primary"
            prepend-icon="mdi-chart-bar"
            variant="tonal"
            @click="router.push(`/Game/${data.gameid}/EndState`)"
          >
            FULL METRICS
          </v-btn>
        </div>
      </article>

      <!-- Prev / Next controls -->
      <footer class="r-replay-footer">
        <v-btn
          :disabled="currentIndex === 0"
          prepend-icon="mdi-chevron-left"
          variant="text"
          @click="prev"
        >
          PREV
        </v-btn>

        <v-btn
          append-icon="mdi-chevron-right"
          color="primary"
          :disabled="currentIndex >= steps.length - 1"
          variant="tonal"
          @click="next"
        >
          NEXT
        </v-btn>
      </footer>
    </template>

    <div v-if="error" class="r-error">{{ error }}</div>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import EvalBar from '@/components/EvalBar.vue'
  import GameOutcomeChip from '@/components/GameOutcomeChip.vue'
  import MissionTracker from '@/components/MissionTracker.vue'
  import PlayerCell from '@/components/PlayerCell.vue'
  import {
    fetchGameReplay,
    type GameReplay,
    type GameReplayPlayer,
    type GameReplayRound,
    type RoundPhase,
  } from '@/services/api'
  import { useGameStore } from '@/stores/game'

  const route = useRoute()
  const router = useRouter()
  const gameStore = useGameStore()

  const data = ref<GameReplay | null>(null)
  const error = ref('')
  const loading = ref(true)
  const currentIndex = ref(0)

  const gameid = computed(() => {
    const v = route.params.GameID ?? route.params.gameID
    return Array.isArray(v) ? v[0] : v
  })

  /**
   * Player-index lookup so step renderers can resolve userid → profile
   * without a linear search every cell. Built once after the fetch.
   */
  const playerByUserid = computed<Record<number, GameReplayPlayer>>(() => {
    const map: Record<number, GameReplayPlayer> = {}
    for (const p of data.value?.players ?? []) map[p.userid] = p
    return map
  })

  const resistancePlayers = computed(() =>
    (data.value?.players ?? []).filter(p => p.side === 'resistance'),
  )
  const spyPlayers = computed(() =>
    (data.value?.players ?? []).filter(p => p.side === 'spy'),
  )

  /**
   * A single linearized step. Each step's `round` reference (if any)
   * points back into `data.rounds[i]` so we can render fields directly
   * without copying.
   */
  type Step
    = | { kind: 'identity', eyebrow: string, label: string, title: string }
      | { kind: 'nomination', eyebrow: string, label: string, title: string, round: GameReplayRound }
      | { kind: 'vote', eyebrow: string, label: string, title: string, round: GameReplayRound }
      | { kind: 'mission', eyebrow: string, label: string, title: string, round: GameReplayRound }
      | { kind: 'suspicion', eyebrow: string, label: string, title: string, round: GameReplayRound }
      | { kind: 'outcome', eyebrow: string, label: string, title: string }

  const steps = computed<Step[]>(() => {
    if (!data.value) return []
    const out: Step[] = [{
      kind: 'identity',
      eyebrow: 'PRE-GAME',
      label: 'Identity Reveal',
      title: 'IDENTITY REVEAL',
    }]

    for (const r of data.value.rounds) {
      const prefix = `Mission ${r.missionIndex} · Attempt ${r.nominationAttempt}`
      out.push({
        kind: 'nomination',
        eyebrow: prefix,
        label: `${prefix} — Nomination`,
        title: 'NOMINATION',
        round: r,
      }, {
        kind: 'vote',
        eyebrow: prefix,
        label: `${prefix} — Vote`,
        title: 'TEAM VOTE',
        round: r,
      })
      // Mission step exists only when the team was approved AND the
      // mission actually played (i.e., DB has a non-null mission_status).
      if (r.voteStatus === true && r.missionStatus !== null) {
        out.push({
          kind: 'mission',
          eyebrow: `Mission ${r.missionIndex}`,
          label: `Mission ${r.missionIndex} — Result`,
          title: 'MISSION',
          round: r,
        })
      }
      // Suspicion only when the row carries a non-empty blob.
      if (r.suspicions && Object.keys(r.suspicions).length > 0) {
        out.push({
          kind: 'suspicion',
          eyebrow: prefix,
          label: `${prefix} — Suspicions`,
          title: 'SUSPICION',
          round: r,
        })
      }
    }

    out.push({
      kind: 'outcome',
      eyebrow: 'GAME OVER',
      label: 'Outcome',
      title: 'OUTCOME',
    })
    return out
  })

  const currentStep = computed<Step | null>(() => steps.value[currentIndex.value] ?? null)

  // --- Eval bar ---
  /**
   * roundId → { before, phaseDeltas }: cumulative differential BEFORE the
   * round plus the round's per-phase contributions, so the bar can advance
   * at every sub-step (nomination → vote → mission → suspicion) instead of
   * jumping once per round.
   */
  const evalByRoundId = computed<Record<number, { before: number, phaseDeltas: Record<RoundPhase, number> }>>(() => {
    const map: Record<number, { before: number, phaseDeltas: Record<RoundPhase, number> }> = {}
    let before = 0
    for (const p of data.value?.evalSeries ?? []) {
      map[p.roundId] = { before, phaseDeltas: p.phaseDeltas }
      before = p.differential
    }
    return map
  })

  const evalMaxAbs = computed(() => {
    let max = 0
    for (const p of data.value?.evalSeries ?? []) max = Math.max(max, Math.abs(p.differential))
    return max
  })

  const PHASE_ORDER: readonly RoundPhase[] = ['nomination', 'vote', 'mission', 'suspicion']

  /**
   * Differential shown at the current step: everything before this round,
   * plus this round's phases up to and including the current step's phase.
   * Identity shows the neutral 0; outcome shows the final value.
   */
  const currentEval = computed(() => {
    const step = currentStep.value
    const series = data.value?.evalSeries ?? []
    if (!step || series.length === 0) return 0
    if (step.kind === 'identity') return 0
    if (step.kind === 'outcome') return series.at(-1)!.differential

    const entry = evalByRoundId.value[step.round.roundId]
    if (!entry) return 0
    let value = entry.before
    for (const phase of PHASE_ORDER) {
      value += entry.phaseDeltas[phase] ?? 0
      if (phase === step.kind) break
    }
    return value
  })

  /**
   * Tick coloring: mission-based for round steps, neutral for identity/outcome,
   * and an "active" highlight on the current index.
   */
  function tickClass (step: Step, i: number): Record<string, boolean> {
    const isActive = i === currentIndex.value
    const isPast = i < currentIndex.value
    const isOutcome = step.kind === 'outcome'
    const isIdentity = step.kind === 'identity'
    return {
      'r-tick-active': isActive,
      'r-tick-past': isPast && !isActive,
      'r-tick-future': !isPast && !isActive,
      'r-tick-bookend': isOutcome || isIdentity,
    }
  }

  function prev () {
    if (currentIndex.value > 0) currentIndex.value--
  }
  function next () {
    if (currentIndex.value < steps.value.length - 1) currentIndex.value++
  }

  // --- Vote step helpers ---
  function voteCount (poll: Record<string, boolean> | null, want: boolean): number {
    if (!poll) return 0
    let n = 0
    for (const v of Object.values(poll)) if (v === want) n++
    return n
  }
  function ballotMark (poll: Record<string, boolean> | null, userid: number): string {
    const v = poll?.[String(userid)]
    if (v === true) return '✓'
    if (v === false) return '✗'
    return '—'
  }
  function ballotClass (poll: Record<string, boolean> | null, userid: number): string {
    const v = poll?.[String(userid)]
    if (v === true) return 'r-ballot-yes'
    if (v === false) return 'r-ballot-no'
    return 'r-ballot-empty'
  }

  // --- Mission step helpers ---
  function cardCount (cards: Record<string, 'success' | 'fail'> | null, want: 'success' | 'fail'): number {
    if (!cards) return 0
    let n = 0
    for (const v of Object.values(cards)) if (v === want) n++
    return n
  }
  function cardMark (cards: Record<string, 'success' | 'fail'> | null, userid: number): string {
    const v = cards?.[String(userid)]
    if (v === 'success') return '✓'
    if (v === 'fail') return '✗'
    return '—'
  }
  function cardCellClass (cards: Record<string, 'success' | 'fail'> | null, userid: number): string {
    const v = cards?.[String(userid)]
    if (v === 'success') return 'r-card-success'
    if (v === 'fail') return 'r-card-fail'
    return ''
  }

  // --- Suspicion step helpers ---
  function suspicionVoters (sus: Record<string, Record<string, number>> | null): string[] {
    if (!sus) return []
    return Object.keys(sus).toSorted((a, b) => Number(a) - Number(b))
  }
  function suspicionCellText (sus: Record<string, Record<string, number>> | null, voterid: string, target: number): string {
    const v = sus?.[voterid]?.[String(target)]
    if (v === undefined || v === 0) return ''
    return String(v)
  }
  function suspicionCellClass (sus: Record<string, Record<string, number>> | null, voterid: string, target: number): string {
    const v = sus?.[voterid]?.[String(target)]
    if (!v || v === 0) return ''
    // Heat scale 1-5 → opacity steps. Spy-target gets red tint, resistance gets blue.
    const targetIsSpy = playerByUserid.value[target]?.side === 'spy'
    return `${targetIsSpy ? 'r-sus-cell-spy' : 'r-sus-cell-resistance'} r-sus-heat-${Math.min(5, Math.max(1, v))}`
  }

  // --- Formatters ---
  function formatDate (s: string): string {
    try {
      return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return s
    }
  }
  function formatOutcomeType (t: string | null | undefined): string {
    if (!t) return ''
    return t.replaceAll('-', ' ').toUpperCase()
  }

  // --- Keyboard nav ---
  function onKeydown (e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      prev()
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      next()
      e.preventDefault()
    }
  }

  // --- Touch nav: horizontal swipe = prev/next (keyboard equivalent) ---
  let touchStartX = 0
  let touchStartY = 0
  function onTouchStart (e: TouchEvent) {
    touchStartX = e.changedTouches[0]?.clientX ?? 0
    touchStartY = e.changedTouches[0]?.clientY ?? 0
  }
  function onTouchEnd (e: TouchEvent) {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX
    const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartY
    // Deliberate horizontal swipe only — ignore taps and vertical scrolls.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) next()
    else prev()
  }

  onMounted(async () => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    if (!gameid.value) {
      error.value = 'No game id'
      loading.value = false
      return
    }
    loading.value = true
    try {
      const fetched = await fetchGameReplay(Number(gameid.value))
      data.value = fetched
      // Hydrate the surrounding [GameID] layout (mission tracker + spy/resistance
      // counts) from the replay payload, using the existing loadFromMetrics
      // action by reshaping `players[]` into team buckets.
      gameStore.loadFromMetrics({
        gameid: fetched.gameid,
        teams: {
          resistance: {
            players: fetched.players
              .filter(p => p.side === 'resistance')
              .map(p => ({ userid: p.userid, username: p.username, pfp: p.pfp })),
          },
          spy: {
            players: fetched.players
              .filter(p => p.side === 'spy')
              .map(p => ({ userid: p.userid, username: p.username, pfp: p.pfp })),
          },
        },
        outcome: {
          winner: fetched.outcome.winner,
          missionStatuses: fetched.outcome.missionStatuses,
        },
      })
    } catch (error_) {
      error.value = (error_ as Error).message
    } finally {
      loading.value = false
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchend', onTouchEnd)
  })
</script>

<style scoped>
.r-replay { padding-top: 24px; padding-bottom: 48px; }

.r-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 12px;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-loading-text {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.r-replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}
.r-replay-title {
  font-size: 1.4rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  margin: 0;
}
.r-replay-sub {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.04em;
  margin: 4px 0 0;
}

.r-timeline-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.r-timeline {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0;
}
.r-tick {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgb(var(--v-theme-border));
  background-color: rgb(var(--v-theme-surface));
  cursor: pointer;
  transition: all 200ms ease-out;
}
/* Phones: 14px ticks are un-tappable — grow them toward the 40px touch
   minimum. The strip already scrolls horizontally so width is safe. */
@media (max-width: 600px) {
  .r-tick { width: 24px; height: 24px; }
}
.r-tick:hover         { transform: translateY(-1px); }
.r-tick-future        { opacity: 0.55; }
.r-tick-past          { background-color: rgb(var(--v-theme-surface-elevated)); }
.r-tick-active        {
  background-color: var(--r-resistance);
  border-color: var(--r-resistance);
  transform: scale(1.15);
}
.r-tick-bookend       { border-radius: 50%; }
.r-timeline-meta {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
}

.r-eval-wrap { margin-bottom: 16px; }

.r-step-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  padding: 20px;
  min-height: 280px;
}
@media (max-width: 600px) {
  .r-step-card { padding: 14px; min-height: 200px; }
}
.r-step-header { margin-bottom: 16px; }
.r-step-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
  text-transform: uppercase;
}
.r-step-title {
  font-size: 1.2rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  margin: 4px 0 0;
}

/* Identity */
.r-identity-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 600px) { .r-identity-grid { grid-template-columns: 1fr; } }
.r-side-title {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  margin: 0 0 8px;
  font-weight: 500;
}
.r-side-title-resistance { color: var(--r-resistance); }
.r-side-title-spy        { color: var(--r-spy); }

.r-player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Nomination */
.r-nom { display: flex; flex-direction: column; gap: 16px; }
.r-nom-label {
  display: block;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
  margin-bottom: 6px;
}

/* Vote */
.r-vote { display: flex; flex-direction: column; gap: 16px; }
/* Result bar — shared by the vote and mission steps. A padded, bordered
   strip that spans the card, with the ✓/✗ tally pushed to the right. */
.r-vote-result-row,
.r-mission-result-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  width: 100%;
  padding: 12px 16px;
  background-color: rgb(var(--v-theme-surface-elevated));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
}
.r-vote-result-label,
.r-mission-result-label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-vote-result-chip,
.r-mission-result-chip {
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  padding: 6px 14px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
}
.r-vote-result-counts,
.r-mission-result-counts {
  margin-left: auto;
  font-size: 0.85rem;
}
.r-vote-chip-yes,
.r-mission-chip-success { color: var(--r-resistance); border-color: rgba(59, 130, 246, 0.55); }
.r-vote-chip-no,
.r-mission-chip-fail    { color: var(--r-spy);        border-color: rgba(239,  68,  68, 0.55); }

.r-ballot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 8px;
}
.r-ballot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
}
.r-ballot-yes { border-color: rgba(59, 130, 246, 0.55); }
.r-ballot-no  { border-color: rgba(239,  68,  68, 0.55); }
.r-ballot-mark {
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}
.r-ballot-yes .r-ballot-mark { color: var(--r-resistance); }
.r-ballot-no  .r-ballot-mark { color: var(--r-spy); }

/* Mission */
.r-mission { display: flex; flex-direction: column; gap: 16px; }
.r-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 8px;
}
.r-card-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
}
.r-card-success { border-color: rgba(59, 130, 246, 0.55); }
.r-card-fail    { border-color: rgba(239,  68,  68, 0.55); }
.r-card-mark {
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}
.r-card-success .r-card-mark { color: var(--r-resistance); }
.r-card-fail    .r-card-mark { color: var(--r-spy); }

/* Suspicion grid */
.r-suspicion { display: flex; flex-direction: column; gap: 8px; }
.r-suspicion-hint { font-size: 0.75rem; }
.r-suspicion-scroll {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.r-suspicion-grid {
  /* Fill the card on desktop so the cells spread out; the scroll wrapper
     still handles overflow when the grid is wider than the viewport. */
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.r-suspicion-grid th, .r-suspicion-grid td {
  padding: 8px 10px;
  border: 1px solid rgb(var(--v-theme-border));
  text-align: center;
  min-width: 48px;
}
.r-suspicion-grid thead th {
  background-color: rgb(var(--v-theme-surface-elevated));
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-sus-row-label {
  text-align: left;
  letter-spacing: 0.04em;
  white-space: nowrap;
  background-color: rgb(var(--v-theme-surface-elevated));
  font-weight: 500;
}
.r-sus-cell-resistance { background-color: rgba(59, 130, 246, 0.16); }
.r-sus-cell-spy        { background-color: rgba(239,  68,  68, 0.16); }
.r-sus-heat-1 { opacity: 0.35; }
.r-sus-heat-2 { opacity: 0.55; }
.r-sus-heat-3 { opacity: 0.75; }
.r-sus-heat-4 { opacity: 0.9; }
.r-sus-heat-5 { opacity: 1; }

/* Outcome */
.r-outcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.r-empty-hint {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  font-style: italic;
}

.r-replay-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.r-error { margin-top: 16px; text-align: center; color: var(--r-spy); font-size: 0.875rem; }
</style>
