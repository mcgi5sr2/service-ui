// A plain object, not run through defineServiceUi: the build must still check it.
export default {
  service: 'fixture',
  views: { './List': () => import('./views/List.vue') },
  tools: [
    {
      id: 'fixture',
      label: 'Fixture',
      description: '',
      icon: 'pi-box',
      base: '/fixture',
      listed: 'everyone',
      routes: [{ path: '', title: 'Things', expose: './List', auth: 'none' }],
      launcher: [{ label: 'Out', icon: 'pi-box', to: '/fixture/../admin', section: 'analysis', order: 1 }],
    },
  ],
}
