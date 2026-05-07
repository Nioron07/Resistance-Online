<template>
  <v-layout>
    <AppNav />

    <v-main style="height: 100vh">
      <v-container>
        <v-row class="align-stretch" justify="center">
          <v-col cols="12" md="4">
            <v-card elevation="4" height="100%">
              <v-card-title class="text-center">{{
                route.params.Username
              }}</v-card-title>

              <v-card-text
                class="d-flex flex-column align-center justify-center"
                style="height: 30%"
              >
                <v-avatar size="150">
                  <v-img v-if="appStore.user?.pfp" :src="appStore.user.pfp" />
                  <v-icon v-else size="150">mdi-account-circle</v-icon>
                </v-avatar>
              </v-card-text>

              <v-card-text>
                <StatsRadarChart :stats="chartData" />
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="8">
            <v-card elevation="4" height="100%">
              <v-card-title>My Stats</v-card-title>

              <v-card-text
                class="d-flex flex-column ga-3"
                style="height: calc(100% - 52px)"
              >
                <!-- General -->
                <div class="stat-section">
                  <div class="stat-section-header text-white">GENERAL</div>

                  <div class="stat-section-body">
                    <div class="stat-row">
                      <v-tooltip location="end" text="Cmon">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Games Played</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value"> {{ metrics?.counts.games ?? '-' }} </span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="how many times you locked in">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Wins</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ metrics?.counts.wins ?? '-' }}</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="how many times you locked out">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Losses</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ metrics?.counts.losses ?? '-' }}</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="u threw">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Throws</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">—</span>
                    </div>
                  </div>
                </div>

                <!-- Resistance -->
                <div class="stat-section stat-section--blue">
                  <div class="stat-section-header">RESISTANCE</div>

                  <div class="stat-section-body">
                    <div class="stat-row">
                      <v-tooltip location="end" text="Lifetime Rate of CD: Fraction of Spies this player has put onto their proposed teams as a Resistance Leader">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">ROCD</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ pct(metrics?.resistance.RoCD_L) }}</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="Games as Resistance">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Games Played</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ metrics?.counts.gamesAsResistance ?? '-' }}</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="Resistance for the win">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Games Won</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">—</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="Lifetime Rate of Sherlock: Measures how good this player is at sussing out spies over thier lifetime">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">ROS</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ pct(metrics?.resistance.RoS_L) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Spy -->
                <div class="stat-section stat-section--red">
                  <div class="stat-section-header">SPY</div>

                  <div class="stat-section-body">
                    <div class="stat-row">
                      <v-tooltip location="end" text="Rate of Illusion: How well a Spy flies under the radar">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">ROI</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ pct(metrics?.spy.RoI_L) }}</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="Games as Spy">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Games Played</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ metrics?.counts.gamesAsSpy ?? '-' }}</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="Spy win">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">Games Won</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">—</span>
                    </div>

                    <div class="stat-row">
                      <v-tooltip location="end" text="Rate of Infiltration: Proportion of times that you were proposed on a team as a spy, that lead to you going on that mission">
                        <template #activator="{ props }">
                          <span class="stat-label" style="cursor: default" v-bind="props">ROIF</span>
                        </template>
                      </v-tooltip>

                      <span class="stat-value">{{ pct(metrics?.spy.RoIF_L) }}</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-layout>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import AppNav from '@/components/AppNav.vue'
  import StatsRadarChart from '@/components/StatsRadarChart.vue'
  import { useAppStore } from '@/stores/app'

  const route = useRoute('/Profile/[Username]')
  const appStore = useAppStore()
  const metrics = ref(null)

  onMounted(async () => {
    const res = await fetch(`/api/users/${appStore.user?.id}/metrics`, {
      credentials: 'include',
    })
    if (res.ok) {
      metrics.value = await res.json()
    }
  })

  // Round a [0..1] (or [-1..1]) ratio to an integer percentage for display.
  function pct (v: number | null | undefined): string {
    if (v == null) return '-'
    return `${Math.round(v * 100)}%`
  }

  // Same conversion, returned as a clamped 0-100 number for the radar chart so
  // the chart axis matches the printed stat values.
  function pctNum (v: number | null | undefined): number {
    if (v == null) return 0
    return Math.max(0, Math.min(100, Math.round(v * 100)))
  }

  const chartData = computed(() => {
    const r = metrics.value?.resistance
    const s = metrics.value?.spy
    const c = metrics.value?.counts
    return {
      Leadership: pctNum(r?.RoCD_L),
      Deception: pctNum(s?.RoI_L),
      Detection: pctNum(r?.RoS_L),
      Consistency: c?.games != null && c?.wins != null && c.games > 0
        ? Math.round((c.wins / c.games) * 100)
        : 0,
      Trust: 0,
    }
  })
</script>

<style scoped>
.stat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

.stat-section-header {
  padding: 6px 14px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-section--blue .stat-section-header {
  color: #90caf9;
  background: rgba(33, 150, 243, 0.12);
  border-bottom-color: rgba(33, 150, 243, 0.2);
}

.stat-section--blue {
  border-color: rgba(33, 150, 243, 0.25);
}

.stat-section--red .stat-section-header {
  color: #ef9a9a;
  background: rgba(244, 67, 54, 0.12);
  border-bottom-color: rgba(244, 67, 54, 0.2);
}

.stat-section--red {
  border-color: rgba(244, 67, 54, 0.25);
}

.stat-section-body {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}
</style>
