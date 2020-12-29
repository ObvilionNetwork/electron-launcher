const builder = require('electron-builder');
const {
  name, productName, description, author,
} = require('./package.json');

const { Platform } = builder;

function getCurrentPlatform() {
  switch (process.platform) {
    case 'win32':
      return Platform.WINDOWS;
    case 'darwin':
      return Platform.MAC;
    case 'linux':
      return Platform.linux;
    default:
      console.error('Cannot resolve current platform!');
      return undefined;
  }
}

const timeStart = new Date().getTime();

builder.build({
  targets: (process.argv[2] != null && Platform[process.argv[2]] != null
      ? Platform[process.argv[2]]
      : getCurrentPlatform()).createTarget(),
  config: {
    appId: name,
    productName,
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-setup-${version}.${ext}',
    copyright: 'Copyright © 2020 Obvilionnetwork.ru',
    directories: {
      buildResources: 'build',
      output: 'dist',
    },
    win: {
      target: [
        {
          target: 'nsis',
          arch: [
            'ia32'
          ]
        }
      ],
      icon: 'src/assets/images/favicon.ico'
    },
    nsis: {
      installerIcon: 'src/assets/images/favicon.ico',
      uninstallerIcon: 'src/assets/images/favicon.ico',
      oneClick: false,
      perMachine: false,
      allowElevation: true,
      allowToChangeInstallationDirectory: true,
    },
    mac: {
      target: 'dmg',
      category: 'public.src-category.games',
    },
    linux: {
      target: 'tar.gz',
      maintainer: author,
      vendor: author,
      synopsis: description,
      description,
      category: 'Game',
    },
    compression: 'maximum',
    files: [
      '!{dist,.gitignore,.vscode,docs,dev-src-update.yml,.travis.yml,.nvmrc,.eslintrc.json,build.js}',
    ],
    extraResources: [
      'libraries',
    ],
    asar: true,
  },
}).then(() => {
  const time = Math.round((new Date().getTime() - timeStart) / 1000);
  console.log(`Build completed in ${time} seconds!`);
}).catch((err) => {
  console.error('Error during build!', err);
});
