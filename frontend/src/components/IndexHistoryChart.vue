<template>
  <VueApexCharts height="280" :options="chartOptions" :series="series" type="line" />
</template>

<script setup lang="ts">
  import type { IndexHistoryPoint } from '@/services/api'
  import { computed } from 'vue'
  import VueApexCharts from 'vue3-apexcharts'

  const props = defineProps<{
    history: IndexHistoryPoint[]
  }>()

  // X axis is the game sequence (1..N). Datetime would bunch up sessions
  // played back-to-back; per-game spacing reads better for a rating chart.
  const series = computed(() => [
    {
      name: 'P-Index',
      data: props.history.map((h, i) => ({ x: i + 1, y: h.pIndex })),
    },
    {
      name: 'R-Index',
      data: props.history.map((h, i) => ({ x: i + 1, y: h.rIndex })),
    },
    {
      name: 'S-Index',
      data: props.history.map((h, i) => ({ x: i + 1, y: h.sIndex })),
    },
  ])

  const chartOptions = computed(() => ({
    chart: {
      type: 'line' as const,
      toolbar: { show: false },
      background: 'transparent',
      animations: { enabled: false },
      zoom: { enabled: false },
    },
    // P neutral/white-ish, R resistance blue, S spy red — matches the
    // MetricCard side colors used elsewhere on the profile.
    colors: ['rgba(229, 231, 235, 0.9)', 'rgba(59, 130, 246, 0.9)', 'rgba(239, 68, 68, 0.9)'],
    stroke: { curve: 'straight' as const, width: [2.5, 1.5, 1.5] },
    markers: { size: 0, hover: { size: 4 } },
    xaxis: {
      type: 'numeric' as const,
      tickAmount: Math.min(10, Math.max(2, props.history.length - 1)),
      decimalsInFloat: 0,
      labels: { style: { colors: 'rgba(156, 163, 175, 0.8)', fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      title: { text: 'GAME', style: { color: 'rgba(156, 163, 175, 0.7)', fontSize: '10px', fontWeight: 400 } },
    },
    yaxis: {
      decimalsInFloat: 1,
      labels: { style: { colors: 'rgba(156, 163, 175, 0.8)', fontSize: '10px' } },
    },
    grid: { borderColor: 'rgba(31, 41, 55, 0.7)', strokeDashArray: 3 },
    legend: {
      labels: { colors: 'rgba(156, 163, 175, 0.9)' },
      markers: { size: 5 },
    },
    tooltip: {
      shared: true,
      x: {
        formatter: (x: number) => {
          const h = props.history[x - 1]
          return h ? `Game #${h.gameid} · ${h.side.toUpperCase()} · ${h.points > 0 ? '+' : ''}${h.points} pts` : `Game ${x}`
        },
      },
    },
    dataLabels: { enabled: false },
    theme: { mode: 'dark' as const },
  }))
</script>
