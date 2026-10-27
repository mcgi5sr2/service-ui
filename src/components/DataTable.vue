<script setup lang="ts" generic="Row extends object">
import type { Column } from './types'

// Sticky mono-uppercase header, hairline rows, hover highlight.
// Render custom cells with a per-column slot named after the column key:
//   <DataTable ...><template #status="{ row, value }">…</template></DataTable>
// Row is unconstrained (any object) so interface-typed rows work without an index
// signature; cell() does the keyed lookup.
withDefaults(
  defineProps<{ columns: Column[]; rows: Row[]; rowKey?: (row: Row, index: number) => string | number; clickable?: boolean }>(),
  { rowKey: undefined, clickable: false },
)
const emit = defineEmits<{ 'row-click': [row: Row] }>()

const cell = (row: Row, key: string): unknown => (row as Record<string, unknown>)[key]
</script>

<template>
  <div class="dt glass">
    <table class="dt__table">
      <thead>
        <tr class="dt__head-row">
          <th v-for="col in columns" :key="col.key" class="dt__th" :class="`dt--${col.align ?? 'left'}`" scope="col">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in rows"
          :key="rowKey ? rowKey(row, i) : i"
          class="dt__row"
          :class="clickable && 'dt__row--clickable'"
          @click="clickable && emit('row-click', row)"
        >
          <td v-for="col in columns" :key="col.key" class="dt__td" :class="`dt--${col.align ?? 'left'}`">
            <slot :name="col.key" :row="row" :value="cell(row, col.key)">{{ cell(row, col.key) }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
@layer service-ui {
  .dt {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--surface);
  }
  .dt__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  .dt__head-row {
    border-bottom: 1px solid var(--border);
  }
  .dt__th {
    position: sticky;
    top: 0;
    background: var(--surface);
    padding: 0.75rem 1rem;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--faint);
  }
  .dt__row {
    border-bottom: 1px solid var(--border-2);
    transition: background-color 150ms;
  }
  .dt__row:last-child {
    border-bottom: 0;
  }
  .dt__row:hover {
    background: var(--surface-2);
  }
  .dt__row--clickable {
    cursor: pointer;
  }
  .dt__td {
    padding: 0.75rem 1rem;
    color: var(--ink);
  }
  .dt--left {
    text-align: left;
  }
  .dt--right {
    text-align: right;
  }
  .dt--center {
    text-align: center;
  }
}
</style>
