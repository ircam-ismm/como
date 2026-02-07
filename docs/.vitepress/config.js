import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "como",
  description: "Documentation website of the como framework",
  base: '/como/',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  themeConfig: {
    logo: '/logo-200x200.png',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/markdown-examples' },
      { text: 'API', link: '/api/index.html', target: '_blank' },
    ],

    sidebar: [
      {
        text: 'Generalities',
        items: [
          { text: 'Ontology', link: '/generalities/ontology' },
          { text: 'Scripts API', link: '/generalities/script-api' },
        ]
      },

      {
        text: 'Ecosystem',
        items: [
          { text: 'soundworks', link: 'https://soundworks.dev/' },
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
