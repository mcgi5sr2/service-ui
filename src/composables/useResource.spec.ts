import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { REFRESH_EVENT, useResource } from './useResource'

describe('useResource', () => {
  it('resolves data, clears loading, and refetches on the refresh event', async () => {
    let n = 0
    const Comp = defineComponent({
      setup() {
        const r = useResource(async () => ++n)
        return () => h('div', `${r.loading.value ? 'load' : 'done'}:${r.data.value ?? ''}`)
      },
    })
    const wrapper = mount(Comp)
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toBe('done:1')

    window.dispatchEvent(new Event(REFRESH_EVENT))
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toBe('done:2')
    wrapper.unmount()
  })

  it('only the latest run writes, and starting a run aborts the previous one', async () => {
    const resolvers: ((v: string) => void)[] = []
    const signals: AbortSignal[] = []
    let r!: ReturnType<typeof useResource<string>>
    const Comp = defineComponent({
      setup() {
        r = useResource((signal) => {
          signals.push(signal)
          return new Promise<string>((res) => resolvers.push(res))
        })
        return () => h('div')
      },
    })
    const wrapper = mount(Comp)
    void r.refetch() // a refresh while the first load is still pending
    expect(signals[0]!.aborted).toBe(true)
    resolvers[1]!('new')
    await flushPromises()
    resolvers[0]!('old') // the slow first load finally answers
    await flushPromises()
    expect(r.data.value).toBe('new')
    expect(r.loading.value).toBe(false)

    void r.refetch()
    wrapper.unmount()
    expect(signals[2]!.aborted).toBe(true)
  })
})
