<template>
  <div class="side-table-wrapper">
    <!-- Desktop / wide: real table -->
    <table v-if="!useStacked" class="side-table tabular-nums">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="[col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left', col.headerClass]"
            :style="col.width ? { width: col.width } : undefined"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-if="rows.length === 0">
          <td class="empty-row" :colspan="columns.length">
            <slot name="empty">{{ emptyText }}</slot>
          </td>
        </tr>

        <tr
          v-for="(row, i) in rows"
          :key="rowKey(row, i)"
          :class="rowClass(row, i)"
          @click="handleRowClick(row, i)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :class="[col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left', col.cellClass]"
          >
            <slot :index="i" :name="`cell.${col.key}`" :row="row">
              {{ defaultCell(row, col) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Mobile / stacked: each row becomes a card with key/value lines -->
    <div v-else class="side-table-stack">
      <div v-if="rows.length === 0" class="empty-row stacked">
        <slot name="empty">{{ emptyText }}</slot>
      </div>

      <div
        v-for="(row, i) in rows"
        :key="rowKey(row, i)"
        class="side-row-card"
        :class="rowClass(row, i)"
        @click="handleRowClick(row, i)"
      >
        <div
          v-for="col in columns"
          :key="col.key"
          class="side-row-line"
          :class="col.stackedHide ? 'd-none' : ''"
        >
          <span class="side-row-label">{{ col.label }}</span>

          <span class="side-row-value">
            <slot :index="i" :name="`cell.${col.key}`" :row="row">
              {{ defaultCell(row, col) }}
            </slot>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup generic="T">
  import { computed } from 'vue'
  import { useDisplay } from 'vuetify'

  export interface ColumnDef<R = unknown> {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    width?: string
    headerClass?: string
    cellClass?: string
    /** When true, hide this column on mobile stacked view. */
    stackedHide?: boolean
    /** Extract a value when no slot is provided. */
    accessor?: (row: R) => unknown
  }

  const props = withDefaults(defineProps<{
    columns: ColumnDef<T>[]
    rows: T[]
    rowKey?: (row: T, index: number) => string | number
    rowClass?: (row: T, index: number) => string | string[] | Record<string, boolean>
    /** Force the stacked variant even on desktop. */
    forceStacked?: boolean
    emptyText?: string
  }>(), {
    rowKey: (_r, i) => i,
    rowClass: () => '',
    forceStacked: false,
    emptyText: 'No rows.',
  })

  const emit = defineEmits<{ 'row-click': [row: T, index: number] }>()

  const { smAndDown } = useDisplay()
  const useStacked = computed(() => props.forceStacked || smAndDown.value)

  function defaultCell (row: T, col: ColumnDef<T>) {
    if (col.accessor) {
      const v = col.accessor(row)
      if (v === null || v === undefined) return '—'
      return v
    }
    const v = (row as Record<string, unknown>)[col.key]
    if (v === null || v === undefined) return '—'
    return v
  }

  function handleRowClick (row: T, index: number) {
    emit('row-click', row, index)
  }
</script>

<style scoped>
.side-table-wrapper { width: 100%; }

.side-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.side-table thead th {
  position: sticky;
  top: 0;
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface-muted));
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.7rem;
  font-weight: 500;
  padding: 10px 12px;
  border-bottom: 1px solid rgb(var(--v-theme-border));
  text-align: left;
  z-index: 1;
}
.side-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(31, 41, 55, 0.5);
  vertical-align: middle;
}
.side-table tbody tr:hover {
  background-color: rgb(var(--v-theme-surface-elevated));
}
.text-right  { text-align: right; }
.text-center { text-align: center; }
.text-left   { text-align: left; }

.empty-row {
  text-align: center;
  color: rgb(var(--v-theme-on-surface-muted));
  padding: 24px 12px;
  font-style: italic;
}
.empty-row.stacked { padding: 32px 12px; border: 1px dashed rgb(var(--v-theme-border)); border-radius: 8px; }

.side-table-stack { display: flex; flex-direction: column; gap: 8px; }
.side-row-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side-row-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
}
.side-row-label {
  color: rgb(var(--v-theme-on-surface-muted));
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.side-row-value {
  text-align: right;
  word-break: break-word;
}
</style>
