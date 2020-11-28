const builder = require('electron-builder');
const { name, productName, description, author } = require('./package.json');

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

builder.build({
  targets: (process.argv[2] != null && Platform[process.argv[2]] != null ? Platform[process.argv[2]] : getCurrentPlatform()).createTarget(),
  config: {
    appId: name,
    productName: productName,
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
          arch: 'x64',
        },
      ],
    },
    nsis: {
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
      target: 'AppImage',
      maintainer: author,
      vendor: author,
      synopsis: description,
      description: description,
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
  console.log('Build complete!');
}).catch((err) => {
  console.error('Error during build!', err);
});
