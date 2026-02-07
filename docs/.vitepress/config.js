import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "como",
  description: "Documentation website of the como framework",
  base: '/como/',
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
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ircam-ismm/como/' }
    ]
  }
})
