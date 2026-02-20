import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "como",
  description: "Documentation website of the como framework",
  base: '/como/',
  head: [['link', { rel: 'icon', href: '/como/favicon.ico' }]],

  markdown: {
    theme: 'monokai',
    lineNumbers: false,
  },

  themeConfig: {
    logo: '/logo-200x200.png',
    search: {
      provider: 'local'
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'API', link: '/api/index.html', target: '_self' },
    ],

    sidebar: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'API', link: '/api/index.html', target: '_self' },
      {
        text: 'Generalities',
        items: [
          { text: 'Ontology', link: '/generalities/ontology' },
          { text: 'Scripts API', link: '/generalities/script-api' },
        ]
      },
      {
        text: 'CoMote Application',
        items: [
          { text: 'Description', link: '/comote/description' },
          { text: 'Webview JS API', link: '/comote/webview-api' },
        ]
      },
      {
        text: 'Motion Sensor Format',
        items: [
          { text: 'v3 - <i>latest</i>', link: '/format/v3' },
          { text: 'CoMote v2 - <i>legacy</i>', link: '/format/comote-v2' },
          { text: 'RIoT v1 & v2 - <i>legacy</i>', link: '/comote/riot-v1-v2' },
        ]
      },

      {
        text: 'Ecosystem',
        items: [
          { text: 'soundworks', link: 'https://soundworks.dev/' },
          { text: 'comote application', link: 'https://apps.ismm.ircam.fr/comote' },
          { text: '@ircam/sc-components', link: 'https://github.com/ircam-ismm/sc-components/' },
          { text: '@ircam/sc-utils', link: 'https://github.com/ircam-ismm/sc-utils' },
          { text: '@ircam/sc-motion', link: 'https://github.com/ircam-ismm/sc-motion/' },
          { text: '@ircam/sc-scheduling', link: 'https://github.com/ircam-ismm/sc-scheduling/' },
          { text: 'node-web-audio-api', link: 'https://github.com/ircam-ismm/node-web-audio-api/' },
          { text: 'dotpi tools', link: 'https://ircam-ismm.github.io/dotpi/' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ircam-ismm/como/' }
    ]
  }
})
