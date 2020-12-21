const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const ConfigManager = require('./configmanager');
const ClientManager = require('./client/clientManager');
const LangLoader = require('./langloader');
const logger = require('./loggerutil')('%c[Preloader]', 'color: #a02d2a; font-weight: bold');

logger.log('Loading..');

// Load ConfigManager
ConfigManager.load();

// Load Strings
LangLoader.loadLanguage('ru_RU');

function onDistroLoad(data) {
  if (data != null) {
    // Resolve the selected server if its value has yet to be set.
    if (ConfigManager.getSelectedServer() == null || data.getServer(ConfigManager.getSelectedServer()) == null) {
      logger.log('Determining default selected server..');
      ConfigManager.setSelectedServer(data.servers[0].name);
      ConfigManager.save();
    }
  }
  ipcRenderer.send('distributionIndexDone', data != null);
}

ClientManager.init().then((data) => {
  logger.log('Loaded distribution index.');
  onDistroLoad(data);
});

// Clean up temp dir incase previous launches ended unexpectedly.
fs.remove(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
  if (err) {
    logger.warn('Error while cleaning natives directory', err);
  } else {
    logger.log('Cleaned natives directory.');
  }
});
