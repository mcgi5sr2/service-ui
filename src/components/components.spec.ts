import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import postcss from 'postcss'
import { compileStyle, parse } from 'vue/compiler-sfc'
import Badge from './Badge.vue'
import Button from './Button.vue'
import DataTable from './DataTable.vue'
import Drawer from './Drawer.vue'
import KpiTile from './KpiTile.vue'
import Segmented from './Segmented.vue'
import Tabs from './Tabs.vue'
import { toneColor, toneTint } from './tone'
import type { Tone } from './types'

describe('Segmented', () => {
  it('emits update:modelValue with the clicked option value', async () => {
    const wrapper = mount(Segmented, {
      props: {
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        modelValue: 'a',
      },
    })
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })
})

describe('Tabs', () => {
  it('marks the selected tab for assistive tech', () => {
    const wrapper = mount(Tabs, {
      props: {
        options: [
          { label: 'One', value: 1 },
          { label: 'Two', value: 2 },
        ],
        modelValue: 2,
      },
    })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0]!.attributes('aria-selected')).toBe('false')
    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
  })
})

describe('Badge', () => {
  it('renders slot content and applies the tone colour', () => {
    const wrapper = mount(Badge, { props: { tone: 'ok' }, slots: { default: 'LIVE' } })
    expect(wrapper.text()).toBe('LIVE')
    expect(wrapper.attributes('style')).toContain('var(--ok)')
  })
})

describe('KpiTile', () => {
  it('colours the value by tone, and neutral as ink', () => {
    const err = mount(KpiTile, { props: { label: 'CVEs', value: 3, tone: 'err' } })
    expect(err.find('.kpi__value').attributes('style')).toContain('var(--err)')
    const neutral = mount(KpiTile, { props: { label: 'Pods', value: 12 } })
    expect(neutral.find('.kpi__value').attributes('style')).toContain('var(--ink)')
  })
})

describe('Button', () => {
  it('renders an anchor for href and a typed button otherwise', () => {
    expect(mount(Button, { props: { href: '/x' } }).element.tagName).toBe('A')
    const btn = mount(Button, { props: { type: 'submit', variant: 'primary' } })
    expect(btn.element.tagName).toBe('BUTTON')
    expect(btn.attributes('type')).toBe('submit')
    expect(btn.classes()).toContain('btn--primary')
  })
})

describe('DataTable', () => {
  it('renders a row per item and supports a per-column cell slot', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { name: 'alpha', status: 'ok' },
          { name: 'beta', status: 'down' },
        ],
      },
      slots: { status: '<span class="pill">{{ params.value }}</span>' },
    })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('alpha')
    expect(wrapper.findAll('.pill')).toHaveLength(2)
  })

  it('emits row-click only when clickable', async () => {
    const props = { columns: [{ key: 'n', label: 'N' }], rows: [{ n: 1 }] }
    const off = mount(DataTable, { props })
    await off.find('tbody tr').trigger('click')
    expect(off.emitted('row-click')).toBeUndefined()
    const on = mount(DataTable, { props: { ...props, clickable: true } })
    await on.find('tbody tr').trigger('click')
    expect(on.emitted('row-click')).toEqual([[{ n: 1 }]])
  })
})

describe('Drawer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('locks body scroll while open and closes on Escape', async () => {
    const wrapper = mount(Drawer, { props: { open: true, title: 'Detail' }, attachTo: document.body })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('Drawer scroll lock', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('stays locked until the last open drawer closes, and never touches it while closed', async () => {
    const a = mount(Drawer, { props: { open: true }, attachTo: document.body })
    const b = mount(Drawer, { props: { open: true }, attachTo: document.body })
    const closed = mount(Drawer, { props: { open: false }, attachTo: document.body })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    await a.setProps({ open: false })
    closed.unmount()
    expect(document.body.style.overflow).toBe('hidden') // b is still open
    b.unmount()
    expect(document.body.style.overflow).toBe('')
    a.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('Drawer stacking', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('Escape closes only the top drawer', async () => {
    const outer = mount(Drawer, { props: { open: true }, attachTo: document.body })
    await nextTick()
    const inner = mount(Drawer, { props: { open: true }, attachTo: document.body })
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(inner.emitted('update:open')).toEqual([[false]])
    expect(outer.emitted('update:open')).toBeUndefined()
    inner.unmount()
    outer.unmount()
  })
})

describe('tone maps', () => {
  it('give every tone a colour and a tint', () => {
    const tones: Tone[] = ['neutral', 'ok', 'warn', 'err', 'accent']
    for (const t of tones) {
      expect(toneColor[t], `toneColor.${t}`).toMatch(/^var\(--/)
      expect(toneTint[t], `toneTint.${t}`).toMatch(/^var\(--/)
    }
  })
})

/**
 * The layering contract: every component's styles sit in the `service-ui` cascade
 * layer, so an app's own rules always beat the kit's defaults whatever their
 * specificity. This compiles each component's <style scoped> the way Vite does and
 * checks that (a) scoping still applies inside the layer and (b) no rule escapes it
 * — keyframes excepted, since they aren't style rules.
 */
describe('component styles', () => {
  const dir = import.meta.dirname
  const files = readdirSync(dir).filter((f) => f.endsWith('.vue'))

  it.each(files)('%s keeps its rules scoped and inside @layer service-ui', (file) => {
    const { descriptor } = parse(readFileSync(join(dir, file), 'utf8'), { filename: file })
    for (const style of descriptor.styles) {
      expect(style.scoped, 'style block must be scoped').toBe(true)
      const { code, errors } = compileStyle({ source: style.content, filename: file, id: 'data-v-test', scoped: true })
      expect(errors).toEqual([])
      expect(code).toContain('[data-v-test]')
      // Every top-level node must be the service-ui layer, a keyframes block or a comment.
      const outside = postcss
        .parse(code)
        .nodes.filter(
          (n) =>
            n.type !== 'comment' &&
            !(n.type === 'atrule' && n.name === 'layer' && n.params === 'service-ui') &&
            !(n.type === 'atrule' && n.name === 'keyframes'),
        )
        .map((n) => n.toString())
      expect(outside, 'rules outside the service-ui layer').toEqual([])
    }
  })
})
