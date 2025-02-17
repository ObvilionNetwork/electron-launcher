/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path = require('path');

const AuthManager = require('./assets/js/authmanager');
const ConfigManager = require('./assets/js/configmanager');
const Lang = require('./assets/js/langloader');
const DiscordWrapper = require('./assets/js/discordWrapper');
const ClientManager = require('./assets/js/client/clientManager');

let rscShouldLoad = false;
let fatalStartupError = false;

// Mapping of each view to their container IDs.
const VIEWS = {
  landing: '#landingContainer',
  login: '#loginContainer',
  settings: '#settingsContainer',
  welcome: '#welcomeContainer',
};

// The currently shown view container.
let currentView;

/**
 * Switch launcher views.
 *
 * @param {string} current The ID of the current view container.
 * @param {*} next The ID of the next view container.
 * @param {*} currentFadeTime Optional. The fade out time for the current view.
 * @param {*} nextFadeTime Optional. The fade in time for the next view.
 * @param {*} onCurrentFade Optional. Callback function to execute when the current
 * view fades out.
 * @param {*} onNextFade Optional. Callback function to execute when the next view
 * fades in.
 */
function switchView(current, next, currentFadeTime = 500, nextFadeTime = 500, onCurrentFade = () => {}, onNextFade = () => {}) {
  const activity = DiscordWrapper.getActivity();
  console.log(next);

  if (next === '#loginContainer') {
    const newActivity = {
      details: 'В меню авторизации',
      startTimestamp: activity.startTimestamp,
      largeImageKey: 'logo',
    };

    DiscordWrapper.setActivity(newActivity);
  } else if (next === '#landingContainer') {
    const newActivity = {
      details: 'Выбирает сервер',
      state: `Игрок: ${ConfigManager.getAuthAccounts()[Object.keys(ConfigManager.getAuthAccounts())[0]].displayName}`,
      startTimestamp: activity.startTimestamp,
      largeImageKey: 'logo',
    };

    DiscordWrapper.setActivity(newActivity);
  }

  DiscordWrapper.render();

  currentView = next;
  $(`${current}`).fadeOut(currentFadeTime, () => {
    onCurrentFade();
    $(`${next}`).fadeIn(nextFadeTime, () => {
      onNextFade();
    });
  });
}
/**
 * Get the currently shown view container.
 *
 * @returns {string} The currently shown view container.
 */
function getCurrentView() {
  return currentView;
}

function showMainUI(data) {
  if (!isDev) {
    loggerAutoUpdater.log('Initializing..');
    ipcRenderer.send('autoUpdateAction', 'initAutoUpdater', ConfigManager.getAllowPrerelease());
  }

  DiscordWrapper.init();

  prepareSettings(true);
  updateSelectedServer(data.getServer(ConfigManager.getSelectedServer()));
  refreshServerStatus();
  setTimeout(() => {
    document.body.style.backgroundImage = `url('assets/images/backgrounds/${document.body.getAttribute('bkid')}.jpg')`;
    $('#main').show();

    const isLoggedIn = Object.keys(ConfigManager.getAuthAccounts()).length > 0;

    // If this is enabled in a development environment we'll get ratelimited.
    // The relaunch frequency is usually far too high.
    if (!isDev && isLoggedIn) {
      validateSelectedAccount();
    }

    if (ConfigManager.isFirstLaunch()) {
      currentView = VIEWS.welcome;
      $(VIEWS.welcome).fadeIn(1000);
    } else if (isLoggedIn) {
      // Discord RP
      const activity = DiscordWrapper.getActivity();
      const newActivity = {
        details: 'Выбирает сервер',
        state: `Игрок: ${ConfigManager.getAuthAccounts()[Object.keys(ConfigManager.getAuthAccounts())[0]].displayName}`,
        startTimestamp: activity.startTimestamp,
        largeImageKey: 'logo',
      };

      DiscordWrapper.setActivity(newActivity);
      DiscordWrapper.render();

      currentView = VIEWS.landing;
      $(VIEWS.landing).fadeIn(1000);
    } else {
      currentView = VIEWS.login;
      $(VIEWS.login).fadeIn(1000);
      frameBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    }

    setTimeout(() => {
      $('#loadingContainer').fadeOut(500, () => {
        $('#loadSpinnerImage').removeClass('rotating');
      });
    }, 250);
  }, 750);
  // Disable tabbing to the news container.
  initNews().then(() => {
    $('#newsContainer *').attr('tabindex', '-1');
  });
}

function showFatalStartupError() {
  setTimeout(() => {
    $('#loadingContainer').fadeOut(250, () => {
      document.getElementById('overlayContainer').style.background = 'none';
      setOverlayContent(
        'Fatal Error: Unable to Load Distribution Index',
        'A connection could not be established to our servers to download the distribution index. No local copies were available to load. <br><br>The distribution index is an essential file which provides the latest server information. The launcher is unable to start without it. Ensure you are connected to the internet and relaunch the application.',
        'Close',
      );
      setOverlayHandler(() => {
        const window = remote.getCurrentWindow();
        window.close();
      });
      toggleOverlay(true);
    });
  }, 750);
}

/**
 * Recursively scan for optional sub modules. If none are found,
 * this function returns a boolean. If optional sub modules do exist,
 * a recursive configuration object is returned.
 *
 * @returns {boolean | Object} The resolved mod configuration.
 */
function scanOptionalSubModules(mdls, origin) {
  if (mdls != null) {
    const mods = {};

    for (const mdl of mdls) {
      const type = mdl.getType();
      // Optional types.
      if (type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader) {
        // It is optional.
        if (!mdl.getRequired().isRequired()) {
          mods[mdl.getVersionlessID()] = scanOptionalSubModules(mdl.getSubModules(), mdl);
        } else if (mdl.hasSubModules()) {
          const v = scanOptionalSubModules(mdl.getSubModules(), mdl);
          if (typeof v === 'object') {
            mods[mdl.getVersionlessID()] = v;
          }
        }
      }
    }

    if (Object.keys(mods).length > 0) {
      const ret = {
        mods,
      };
      if (!origin.getRequired().isRequired()) {
        ret.value = origin.getRequired().isDefault();
      }
      return ret;
    }
  }
  return origin.getRequired().isDefault();
}

/**
 * Recursively merge an old configuration into a new configuration.
 *
 * @param {boolean | Object} o The old configuration value.
 * @param {boolean | Object} n The new configuration value.
 * @param {boolean} nReq If the new value is a required mod.
 *
 * @returns {boolean | Object} The merged configuration.
 */
function mergeModConfiguration(o, n, nReq = false) {
  if (typeof o === 'boolean') {
    if (typeof n === 'boolean') return o;
    if (typeof n === 'object') {
      if (!nReq) {
        n.value = o;
      }
      return n;
    }
  } else if (typeof o === 'object') {
    if (typeof n === 'boolean') return typeof o.value !== 'undefined' ? o.value : true;
    if (typeof n === 'object') {
      if (!nReq) {
        n.value = typeof o.value !== 'undefined' ? o.value : true;
      }

      const newMods = Object.keys(n.mods);
      for (let i = 0; i < newMods.length; i++) {
        const mod = newMods[i];
        if (o.mods[mod] != null) {
          n.mods[mod] = mergeModConfiguration(o.mods[mod], n.mods[mod]);
        }
      }

      return n;
    }
  }
  // If for some reason we haven't been able to merge,
  // wipe the old value and use the new one. Just to be safe
  return n;
}

function refreshDistributionIndex(remote, onSuccess, onError) {
  if (remote) {
    DistroManager.pullRemote()
      .then(onSuccess)
      .catch(onError);
  } else {
    DistroManager.pullLocal()
      .then(onSuccess)
      .catch(onError);
  }
}

async function validateSelectedAccount() {
  const selectedAcc = ConfigManager.getSelectedAccount();
  if (selectedAcc != null) {
    const val = await AuthManager.validateSelected();
    if (!val) {
      ConfigManager.removeAuthAccount(selectedAcc.uuid);
      ConfigManager.save();
      const accLen = Object.keys(ConfigManager.getAuthAccounts()).length;
      setOverlayContent(
        'Failed to Refresh Login',
        `We were unable to refresh the login for <strong>${selectedAcc.displayName}</strong>. Please ${accLen > 0 ? 'select another account or ' : ''} login again.`,
        'Login',
        'Select Another Account',
      );
      setOverlayHandler(() => {
        document.getElementById('loginUsername').value = selectedAcc.username;
        validateEmail(selectedAcc.username);
        loginViewOnSuccess = getCurrentView();
        loginViewOnCancel = getCurrentView();
        if (accLen > 0) {
          loginViewCancelHandler = () => {
            ConfigManager.addAuthAccount(selectedAcc.uuid, selectedAcc.accessToken, selectedAcc.username, selectedAcc.displayName);
            ConfigManager.save();
            validateSelectedAccount();
          };
          loginCancelEnabled(true);
        }
        toggleOverlay(false);
        switchView(getCurrentView(), VIEWS.login);
      });
      setDismissHandler(() => {
        if (accLen > 1) {
          prepareAccountSelectionList();
          $('#overlayContent').fadeOut(250, () => {
            bindOverlayKeys(true, 'accountSelectContent', true);
            $('#accountSelectContent').fadeIn(250);
          });
        } else {
          const accountsObj = ConfigManager.getAuthAccounts();
          const accounts = Array.from(Object.keys(accountsObj), (v) => accountsObj[v]);
          // This function validates the account switch.
          setSelectedAccount(accounts[0].uuid);
          toggleOverlay(false);
        }
      });
      toggleOverlay(true, accLen > 0);
    } else {
      return true;
    }
  } else {
    return true;
  }
}

/**
 * Temporary function to update the selected account along
 * with the relevent UI elements.
 *
 * @param {string} uuid The UUID of the account.
 */
function setSelectedAccount(uuid) {
  const authAcc = ConfigManager.setSelectedAccount(uuid);
  ConfigManager.save();
  updateSelectedAccount(authAcc);
  validateSelectedAccount();
}

// Synchronous Listener
document.addEventListener('readystatechange', () => {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    if (rscShouldLoad) {
      rscShouldLoad = false;
      if (!fatalStartupError) {
        const data = ClientManager.getDistribution();
        showMainUI(data);
      } else {
        showFatalStartupError();
      }
    }
  }
}, false);

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', (event, res) => {
  if (res) {
    const data = ClientManager.getDistribution();
    //syncModConfigurations(data); TODO
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      showMainUI(data);
    } else {
      rscShouldLoad = true;
    }
  } else {
    fatalStartupError = true;
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      showFatalStartupError();
    } else {
      rscShouldLoad = true;
    }
  }
});
