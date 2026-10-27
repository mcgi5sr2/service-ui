import { defineServiceUi } from 'service-ui/define'

export default defineServiceUi({
  service: 'fixture',
  views: {
    './List': () => import('./views/List.vue'),
    './Card': () => import('./views/Card.vue'),
  },
  tools: [
    {
      id: 'fixture',
      label: 'Fixture',
      description: 'A tool used by the build test.',
      icon: 'pi-box',
      base: '/fixture',
      listed: 'everyone',
      routes: [
        { path: '', title: 'Things', expose: './List', auth: 'none' },
        { path: ':id/detail', title: 'Detail', expose: './List', auth: 'required', fullBleed: true },
      ],
      launcher: [{ label: 'Fixture', icon: 'pi-box', to: '/fixture', section: 'analysis', order: 10 }],
      // Not a manifest field: must not reach the public manifest.json.
      internalNote: 'keep me out of the manifest',
    },
  ],
  slots: { provides: [{ slot: 'person.card', expose: './Card', props: 1 }], hosts: [{ slot: 'other.panel', props: 2 }] },
  feedback: { repo: 'example/fixture' },
})
