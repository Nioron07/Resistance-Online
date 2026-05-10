import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SideTable from '@/components/SideTable.vue'

interface Row { name: string, value: number }

const cols = [
  { key: 'name', label: 'NAME', align: 'left' as const },
  { key: 'value', label: 'VALUE', align: 'right' as const },
]

describe('SideTable', () => {
  it('renders a row per data entry with a header', () => {
    const w = mount(SideTable<Row>, {
      props: { columns: cols, rows: [{ name: 'a', value: 1 }, { name: 'b', value: 2 }] },
    })
    // 1 header row + 2 data rows
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.findAll('thead th')).toHaveLength(2)
  })

  it('renders the empty state when rows is empty', () => {
    const w = mount(SideTable<Row>, {
      props: { columns: cols, rows: [] as Row[], emptyText: 'NOTHING HERE' },
    })
    expect(w.text()).toContain('NOTHING HERE')
  })

  it('accessor function trumps default key lookup', () => {
    const acc = [
      { ...cols[0]!, accessor: (r: Row) => r.name.toUpperCase() },
      cols[1]!,
    ]
    const w = mount(SideTable<Row>, { props: { columns: acc, rows: [{ name: 'foo', value: 1 }] } })
    expect(w.text()).toContain('FOO')
  })

  it('forceStacked flips to the stacked card layout', () => {
    const w = mount(SideTable<Row>, {
      props: { columns: cols, rows: [{ name: 'a', value: 1 }], forceStacked: true },
    })
    expect(w.find('.side-row-card').exists()).toBe(true)
    expect(w.find('table').exists()).toBe(false)
  })

  it('emits row-click with the row object when a row is clicked', async () => {
    const w = mount(SideTable<Row>, {
      props: { columns: cols, rows: [{ name: 'a', value: 1 }, { name: 'b', value: 2 }] },
    })
    await w.findAll('tbody tr')[1]!.trigger('click')
    expect(w.emitted('row-click')).toBeTruthy()
    expect(w.emitted('row-click')![0][0]).toEqual({ name: 'b', value: 2 })
  })
})
