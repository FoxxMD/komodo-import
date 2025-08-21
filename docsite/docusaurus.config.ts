import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import * as themes from 'prism-react-renderer';
//import sidebars from './sidebars';

const config: Config = {
  future: {
    v4: {
      removeLegacyPostBuildHeadAttribute: true, // required
    },
    // experimental_faster: {
    //   ssgWorkerThreads: true,
    //   rspackBundler: true, // required flag
    //   rspackPersistentCache: true, // new flag
    // },
    experimental_faster: true
  },
  title: 'Komodo Import',
  tagline: 'Import existing projects into Komodo',

  // Set the production url of your site here
  url: 'https://foxxmd.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: process.env.DOCS_BASE !== undefined && process.env.DOCS_BASE !== '' ? process.env.DOCS_BASE : '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'foxxmd', // Usually your GitHub org/user name.
  projectName: 'komodo-import', // Usually your repo name.

  trailingSlash: true,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  scripts: [
  ],
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        // blog: {
        //   showReadingTime: true,
        //   // Please change this to your repo.
        //   // Remove this to remove the "edit this page" links.
        //   editUrl:
        //     'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        // },
        blog: false,

        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themes: [
    [
      "@easyops-cn/docusaurus-search-local",
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      {
        // ... Your options.
        // `hashed` is recommended as long-term-cache of index file is possible.
        hashed: true,
        indexBlog: false,
        // For Docs using Chinese, The `language` is recommended to set to:
        // ```
        // language: ["en", "zh"],
        // ```
      },
    ],
    'docusaurus-theme-github-codeblock'
  ],
  plugins: [

      // Custom plugin to modify Webpack config
    function myPlugin(context, options) {
      return {
        name: 'custom-webpack-plugin',
        configureWebpack(config, isServer, utils, content) {
          return {
            module: {
              rules: [
                {
                  resourceQuery: /raw/,
                  type: "asset/source",
                },
              ],
            },
          };
        },
      };
    },
        [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 70,
        max: 1030, // max resized image's size.
        min: 640, // min resized image's size. if original is lower, use that size.
        steps: 2, // the max number of images generated between min and max (inclusive)
        disableInDev: false,
      },
    ],
  ],
  themeConfig:
    {
      // Replace with your project's social card
      navbar: {
        title: 'Komodo Import',
        hideOnScroll: true,
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/foxxmd/komodo-import',
            label: 'GitHub',
            position: 'right',
          },
          {
            href: 'https://foxxmd.github.io/komodo-import/',
            label: 'Website',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Overview',
                to: '/',
              },
              {
                label: 'Installation',
                to: 'docs/installation',
              },
              {
                label: 'Usage',
                to: 'docs/usage',
              }
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/foxxmd/komodo-import',
              },
              {
                label: 'Website',
                href: 'https://foxxmd.github.io/komodo-import/',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Komodo Import. Built with Docusaurus.`,
      },
      prism: {
        theme: themes.themes.github,
        darkTheme: themes.themes.dracula,
        additionalLanguages: ['json','json5','typescript', 'docker', 'bash', 'ini','yaml']
      },
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      codeblock: {
        showGithubLink: true,
        githubLinkLabel: 'View on GitHub',
        showRunmeLink: false,
        runmeLinkLabel: 'Checkout via Runme'
      }
    } satisfies Preset.ThemeConfig,
    headTags: [
      {
        tagName: 'meta',
        attributes: {
          name: 'google-site-verification',
          content: process.env.GSITEVERIFICATION ?? 'none'
        }
      }
    ]
};

if (process.env.RY_ANALYTICS !== undefined && process.env.RY_ANALYTICS !== '') {
  const script = {
    src: process.env.RY_ANALYTICS,
    defer: true
  }
  if (process.env.RY_ANALYTICS_SITEID !== undefined && process.env.RY_ANALYTICS_SITEID !== '') {
    script['data-site-id'] = process.env.RY_ANALYTICS_SITEID;
  }
  if (process.env.RY_ANALYTICS_REPLAY !== undefined && process.env.RY_ANALYTICS_REPLAY !== '') {
    script['data-session-replay'] = process.env.RY_ANALYTICS_REPLAY;
  }
  config.scripts.push(script)
}

export default config;
