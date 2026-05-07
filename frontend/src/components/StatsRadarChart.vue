<template>
  <VueApexCharts height="300" :options="chartOptions" :series="series" type="radar" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import VueApexCharts from 'vue3-apexcharts'

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
    fill: { colors: ['rgba(180,180,180,0.15)'] },
    stroke: { colors: ['rgba(180,180,180,0.7)'], width: 1 },
    markers: { colors: ['rgba(180,180,180,0.9)'], size: 3 },
    plotOptions: {
      radar: {
        polygons: {
          strokeColors: 'rgba(150,150,150,0.3)',
          connectorColors: 'rgba(150,150,150,0.3)',
          fill: { colors: ['transparent'] },
        },
      },
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    theme: { mode: 'dark' as const },
  }
</script>
