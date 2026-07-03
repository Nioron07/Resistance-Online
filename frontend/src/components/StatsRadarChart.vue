<template>
  <VueApexCharts :height="chartHeight" :options="chartOptions" :series="series" type="radar" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useDisplay } from 'vuetify'
  import VueApexCharts from 'vue3-apexcharts'

  const { smAndDown } = useDisplay()
  const chartHeight = computed(() => (smAndDown.value ? 220 : 300))

  const props = defineProps<{
    stats?: {
      Leadership: number
      Deception: number
      Detection: number
      Consistency: number
      Trust: number
    }
  }>()

  const series = computed(() => [{
    name: 'Stats',
    data: props.stats
      ? [props.stats.Leadership, props.stats.Deception, props.stats.Detection, props.stats.Consistency, props.stats.Trust]
      : [0, 0, 0, 0, 0],
  }])

  const chartOptions = {
    chart: { type: 'radar' as const, toolbar: { show: false }, background: 'transparent' },
    xaxis: { categories: ['Leadership', 'Deception / ROI', 'Detection / ROS', 'Consistency', 'Trust'] },
    yaxis: { min: 0, max: 100, show: false },
    fill: { colors: ['rgba(59, 130, 246, 0.18)'] },
    stroke: { colors: ['rgba(59, 130, 246, 0.85)'], width: 1.5 },
    markers: { colors: ['rgba(59, 130, 246, 0.95)'], size: 3 },
    plotOptions: {
      radar: {
        polygons: {
          strokeColors: 'rgba(31, 41, 55, 0.7)',
          connectorColors: 'rgba(31, 41, 55, 0.5)',
          fill: { colors: ['transparent'] },
        },
      },
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    theme: { mode: 'dark' as const },
  }
</script>
