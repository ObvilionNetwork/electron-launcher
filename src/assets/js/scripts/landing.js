/**
 * Script for landing.ejs
 */
// Requirements
const cp = require('child_process');
const crypto = require('crypto');
const { URL } = require('url');

// Internal Requirements
const ServerStatus = require('./assets/js/serverstatus');

// Launch Elements
const launch_content = document.getElementById('launch_content');
const launch_details = document.getElementById('launch_details');
const launch_progress = document.getElementById('launch_progress');
const launch_progress_label = document.getElementById('launch_progress_label');
const launch_details_text = document.getElementById('launch_details_text');
const server_selection_button = document.getElementById('server_selection_button');
const user_text = document.getElementById('user_text');

const loggerLanding = LoggerUtil('%c[Landing]', 'color: #000668; font-weight: bold');

/* Launch Progress Wrapper Functions */

/**
 * Show/hide the loading area.
 *
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading) {
  if (loading) {
    launch_details.style.display = 'flex';
    launch_content.style.display = 'none';
  } else {
    launch_details.style.display = 'none';
    launch_content.style.display = 'inline-flex';
  }
}

/**
 * Set the details text of the loading area.
 *
 * @param {string} details The new text for the loading details.
 */
function setLaunchDetails(details) {
  launch_details_text.innerHTML = details;
}

/**
 * Set the value of the loading progress bar and display that value.
 *
 * @param {number} value The progress value.
 * @param {number} max The total size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setLaunchPercentage(value, max, percent = ((value / max) * 100)) {
  launch_progress.setAttribute('max', max);
  launch_progress.setAttribute('value', value);
  launch_progress_label.innerHTML = `${percent}%`;
}

/**
 * Set the value of the OS progress bar and display that on the UI.
 *
 * @param {number} value The progress value.
 * @param {number} max The total download size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setDownloadPercentage(value, max, percent = ((value / max) * 100)) {
  remote.getCurrentWindow().setProgressBar(value / max);
  setLaunchPercentage(value, max, percent);
}

/**
 * Enable or disable the launch button.
 *
 * @param {boolean} val True to enable, false to disable.
 */
function setLaunchEnabled(val) {
  document.getElementById('launch_button').disabled = !val;
}

// Bind launch button
document.getElementById('launch_button').addEventListener('click', (e) => {
  loggerLanding.log('Launching game..');

  const mcVersion = ClientManager.getDistribution().getServer(ConfigManager.getSelectedServer()).getVersion();
  const jExe = ConfigManager.getJavaExecutable();

  if (jExe == null) {
    //TODO
  } else {
    setLaunchDetails(Lang.queryJS('landing.launch.pleaseWait'));
    toggleLaunchArea(true);
    setLaunchPercentage(0, 100);

    const downloader = new ClientManager.ClientDownloader(
       ClientManager.getDistribution().getServer(ConfigManager.getSelectedServer())
    );

    downloader.on('download', (t) => {
      console.log(t)
      setLaunchDetails(t.path);
    })

    downloader.on('complete', () => {
      setLaunchDetails('Загрузка закончена');

      setTimeout(() => {
        remote.getCurrentWindow().hide();
      }, 1000);
    })

    downloader.on('exit', () => {
      remote.getCurrentWindow().show();
      toggleLaunchArea(false);
    });

    downloader.start();
  }
});

const frameBar = document.getElementById('frameBar');

// Bind settings button
document.getElementById('settingsMediaButton').onclick = (e) => {
  prepareSettings();
  switchView(getCurrentView(), VIEWS.settings);

  setTimeout(() => {
    frameBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  }, 540);
};

// Bind avatar overlay button.
document.getElementById('avatarOverlay').onclick = (e) => {
  prepareSettings();

  switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
    settingsNavItemListener(document.getElementById('settingsNavAccount'), false);
  });

  setTimeout(() => {
    frameBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  }, 540);
};
// Bind selected account
function updateSelectedAccount(authUser) {
  let username = 'Аккаунт не выбран';

  if (authUser != null) {
    if (authUser.displayName != null) {
      username = authUser.displayName;
    }
    if (authUser.uuid != null) {
      document.getElementById('avatarContainer').style.backgroundImage = `url('https://obvilionnetwork.ru/api/users/get/${authUser.displayName}/avatar')`;
    }
  }

  user_text.innerHTML = username;
}

updateSelectedAccount(ConfigManager.getSelectedAccount());

// Bind selected server
function updateSelectedServer(serv) {
  if (getCurrentView() === VIEWS.settings) {
    saveAllModConfigurations();
  }
  ConfigManager.setSelectedServer(serv != null ? serv.getID() : null);
  ConfigManager.save();
  server_selection_button.innerHTML = `\u2022 ${serv != null ? serv.getName() : 'No Server Selected'}`;
  if (getCurrentView() === VIEWS.settings) {
    animateModsTabRefresh();
  }
  setLaunchEnabled(serv != null);
}
// Real text is set in uibinder.js on distributionIndexDone.
server_selection_button.innerHTML = '\u2022 Загрузка..';
server_selection_button.onclick = (e) => {
  e.target.blur();
  toggleServerSelection(true);
};

const refreshServerStatus = async (fade = false) => {
  loggerLanding.log('Refreshing Server Status');
  const serv = ClientManager.getDistribution().getServer(ConfigManager.getSelectedServer());

  let pLabel = 'СЕРВЕР';
  let pVal = 'ОФФЛАЙН';

  try {
    const serverURL = new URL(`my://${serv.getServerIP()}`);
    const servStat = await ServerStatus.getStatus(serverURL.hostname, serverURL.port);
    if (servStat.online) {
      pLabel = 'ИГРОКОВ';
      pVal = `${servStat.onlinePlayers}/${servStat.maxPlayers}`;
    }
  } catch (err) {
    loggerLanding.warn('Unable to refresh server status, assuming offline.');
    loggerLanding.debug(err);
  }

  if (fade) {
    $('#server_status_wrapper').fadeOut(250, () => {
      document.getElementById('landingPlayerLabel').innerHTML = pLabel;
      document.getElementById('player_count').innerHTML = pVal;
      $('#server_status_wrapper').fadeIn(500);
    });
  } else {
    document.getElementById('landingPlayerLabel').innerHTML = pLabel;
    document.getElementById('player_count').innerHTML = pVal;
  }
}
const serverStatusListener = setInterval(() => refreshServerStatus(true), 300000);

/**
 * Shows an error overlay, toggles off the launch area.
 *
 * @param {string} title The overlay title.
 * @param {string} desc The overlay description.
 */
function showLaunchFailure(title, desc) {
  setOverlayContent(
    title,
    desc,
    'Окей',
  );
  setOverlayHandler(null);
  toggleOverlay(true);
  toggleLaunchArea(false);
}

/**
 * News Loading Functions
 */

// DOM Cache
const newsContent = document.getElementById('newsContent');
const newsArticleTitle = document.getElementById('newsArticleTitle');
const newsArticleDate = document.getElementById('newsArticleDate');
const newsArticleAuthor = document.getElementById('newsArticleAuthor');
const newsArticleComments = document.getElementById('newsArticleComments');
const newsNavigationStatus = document.getElementById('newsNavigationStatus');
const newsArticleContentScrollable = document.getElementById('newsArticleContentScrollable');
const nELoadSpan = document.getElementById('nELoadSpan');

// News slide caches.
let newsActive = false;
let newsGlideCount = 0;

/**
 * Show the news UI via a slide animation.
 *
 * @param {boolean} up True to slide up, otherwise false.
 */
function slide_(up) {
  const lCUpper = document.querySelector('#landingContainer > #upper');
  const lCLLeft = document.querySelector('#landingContainer > #lower > #left');
  const lCLCenter = document.querySelector('#landingContainer > #lower > #center');
  const lCLRight = document.querySelector('#landingContainer > #lower > #right');
  const newsBtn = document.querySelector('#landingContainer > #lower > #center #content');
  const landingContainer = document.getElementById('landingContainer');
  const newsContainer = document.querySelector('#landingContainer > #newsContainer');

  newsGlideCount++;

  if (up) {
    lCUpper.style.top = '-200vh';
    lCLLeft.style.top = '-200vh';
    lCLCenter.style.top = '-200vh';
    lCLRight.style.top = '-200vh';
    newsBtn.style.top = '130vh';
    newsContainer.style.top = '0px';

    landingContainer.style.background = 'rgba(0, 0, 0, 0.50)';

    setTimeout(() => {
      if (newsGlideCount === 1) {
        lCLCenter.style.transition = 'none';
        newsBtn.style.transition = 'none';
      }
      newsGlideCount--;
    }, 2000);
  } else {

    setTimeout(() => {
      newsGlideCount--;
    }, 2000);

    landingContainer.style.background = null;

    lCLCenter.style.transition = null;
    newsBtn.style.transition = null;

    newsContainer.style.top = '100%';
    lCUpper.style.top = '0px';
    lCLLeft.style.top = '0px';
    lCLCenter.style.top = '0px';
    lCLRight.style.top = '0px';
    newsBtn.style.top = '10px';
  }
}

// Bind news button.
document.getElementById('newsButton').onclick = () => {
  // Toggle tabbing.
  if (newsActive) {
    $('#landingContainer *').removeAttr('tabindex');
    $('#newsContainer *').attr('tabindex', '-1');
  } else {
    $('#landingContainer *').attr('tabindex', '-1');
    $('#newsContainer, #newsContainer *, #lower, #lower #center *').removeAttr('tabindex');
    if (newsAlertShown) {
      $('#newsButtonAlert').fadeOut(2000);
      newsAlertShown = false;
      ConfigManager.setNewsCacheDismissed(true);
      ConfigManager.save();
    }
  }
  slide_(!newsActive);
  newsActive = !newsActive;
};

// Array to store article meta.
let newsArr = null;

// News load animation listener.
let newsLoadingListener = null;

/**
 * Set the news loading animation.
 *
 * @param {boolean} val True to set loading animation, otherwise false.
 */
function setNewsLoading(val) {
  if (val) {
    const nLStr = 'Checking for News';
    let dotStr = '..';
    nELoadSpan.innerHTML = nLStr + dotStr;
    newsLoadingListener = setInterval(() => {
      if (dotStr.length >= 3) {
        dotStr = '';
      } else {
        dotStr += '.';
      }
      nELoadSpan.innerHTML = nLStr + dotStr;
    }, 750);
  } else if (newsLoadingListener != null) {
    clearInterval(newsLoadingListener);
    newsLoadingListener = null;
  }
}

// Bind retry button.
newsErrorRetry.onclick = () => {
  $('#newsErrorFailed').fadeOut(250, () => {
    initNews();
    $('#newsErrorLoading').fadeIn(250);
  });
};

newsArticleContentScrollable.onscroll = (e) => {
  if (e.target.scrollTop > Number.parseFloat($('.newsArticleSpacerTop').css('height'))) {
    newsContent.setAttribute('scrolled', '');
  } else {
    newsContent.removeAttribute('scrolled');
  }
};

/**
 * Reload the news without restarting.
 *
 * @returns {Promise.<void>} A promise which resolves when the news
 * content has finished loading and transitioning.
 */
function reloadNews() {
  return new Promise((resolve, reject) => {
    $('#newsContent').fadeOut(250, () => {
      $('#newsErrorLoading').fadeIn(250);
      initNews().then(() => {
        resolve();
      });
    });
  });
}

let newsAlertShown = false;

/**
 * Show the news alert indicating there is new news.
 */
function showNewsAlert() {
  newsAlertShown = true;
  $(newsButtonAlert).fadeIn(250);
}

/**
 * Initialize News UI. This will load the news and prepare
 * the UI accordingly.
 *
 * @returns {Promise.<void>} A promise which resolves when the news
 * content has finished loading and transitioning.
 */
function initNews() {
  return new Promise((resolve, reject) => {
    setNewsLoading(true);

    const news = {};
    loadNews().then((news) => {
      newsArr = news.articles || null;

      if (newsArr == null) {
        // News Loading Failed
        setNewsLoading(false);

        $('#newsErrorLoading').fadeOut(250, () => {
          $('#newsErrorFailed').fadeIn(250, () => {
            resolve();
          });
        });
      } else if (newsArr.length === 0) {
        // No News Articles
        setNewsLoading(false);

        ConfigManager.setNewsCache({
          date: null,
          content: null,
          dismissed: false,
        });
        ConfigManager.save();

        $('#newsErrorLoading').fadeOut(250, () => {
          $('#newsErrorNone').fadeIn(250, () => {
            resolve();
          });
        });
      } else {
        // Success
        setNewsLoading(false);

        const lN = newsArr[0];
        const cached = ConfigManager.getNewsCache();
        const newHash = crypto.createHash('sha1').update(lN.content).digest('hex');
        const newDate = new Date(lN.date);
        let isNew = false;

        if (cached.date != null && cached.content != null) {
          if (new Date(cached.date) >= newDate) {
            // Compare Content
            if (cached.content !== newHash) {
              isNew = true;
              showNewsAlert();
            } else if (!cached.dismissed) {
              isNew = true;
              showNewsAlert();
            }
          } else {
            isNew = true;
            showNewsAlert();
          }
        } else {
          isNew = true;
          showNewsAlert();
        }

        if (isNew) {
          ConfigManager.setNewsCache({
            date: newDate.getTime(),
            content: newHash,
            dismissed: false,
          });
          ConfigManager.save();
        }

        const switchHandler = (forward) => {
          const cArt = parseInt(newsContent.getAttribute('article'));
          const nxtArt = forward ? (cArt >= newsArr.length - 1 ? 0 : cArt + 1) : (cArt <= 0 ? newsArr.length - 1 : cArt - 1);

          displayArticle(newsArr[nxtArt], nxtArt + 1);
        };

        document.getElementById('newsNavigateRight').onclick = () => { switchHandler(true); };
        document.getElementById('newsNavigateLeft').onclick = () => { switchHandler(false); };

        $('#newsErrorContainer').fadeOut(250, () => {
          displayArticle(newsArr[0], 1);
          $('#newsContent').fadeIn(250, () => {
            resolve();
          });
        });
      }
    });
  });
}

/**
 * Add keyboard controls to the news UI. Left and right arrows toggle
 * between articles. If you are on the landing page, the up arrow will
 * open the news UI.
 */
document.addEventListener('keydown', (e) => {
  if (newsActive) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      document.getElementById(e.key === 'ArrowRight' ? 'newsNavigateRight' : 'newsNavigateLeft').click();
    }
    // Interferes with scrolling an article using the down arrow.
    // Not sure of a straight forward solution at this point.
    // if(e.key === 'ArrowDown'){
    //     document.getElementById('newsButton').click()
    // }
  } else if (getCurrentView() === VIEWS.landing) {
    if (e.key === 'ArrowUp') {
      document.getElementById('newsButton').click();
    }
  }
});

/**
 * Display a news article on the UI.
 *
 * @param {Object} articleObject The article meta object.
 * @param {number} index The article index.
 */
function displayArticle(articleObject, index) {
  newsArticleTitle.innerHTML = articleObject.title;
  newsArticleTitle.href = articleObject.link;
  newsArticleAuthor.innerHTML = `by ${articleObject.author}`;
  newsArticleDate.innerHTML = articleObject.date;
  newsArticleComments.innerHTML = articleObject.comments;
  newsArticleComments.href = articleObject.commentsLink;
  newsArticleContentScrollable.innerHTML = `<div id="newsArticleContentWrapper"><div class="newsArticleSpacerTop"></div>${articleObject.content}<div class="newsArticleSpacerBot"></div></div>`;
  Array.from(newsArticleContentScrollable.getElementsByClassName('bbCodeSpoilerButton')).forEach((v) => {
    v.onclick = () => {
      const text = v.parentElement.getElementsByClassName('bbCodeSpoilerText')[0];
      text.style.display = text.style.display === 'block' ? 'none' : 'block';
    };
  });
  newsNavigationStatus.innerHTML = `${index} of ${newsArr.length}`;
  newsContent.setAttribute('article', index - 1);
}

/**
 * Load news information from the RSS feed specified in the
 * distribution index.
 */
function loadNews() {
  return new Promise((resolve, reject) => {
    // const distroData = ClientManager.getDistribution();
    // const newsFeed = distroData.getRSS();
    // const newsHost = `${new URL('https://obvilionnetwork.ru/api/news').origin}/`;
    // $.ajax({
    //   url: newsFeed,
    //   success: (data) => {
    //     const items = $(data).find('item');
    //     const articles = [];
    //
    //     for (let i = 0; i < items.length; i++) {
    //       // JQuery Element
    //       const el = $(items[i]);
    //
    //       // Resolve date.
    //       const date = new Date(el.find('pubDate').text()).toLocaleDateString('en-US', {
    //         month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric',
    //       });
    //
    //       // Resolve comments.
    //       let comments = el.find('slash\\:comments').text() || '0';
    //       comments = `${comments} Comment${comments === '1' ? '' : 's'}`;
    //
    //       // Fix relative links in content.
    //       let content = el.find('content\\:encoded').text();
    //       const regex = /src="(?!http:\/\/|https:\/\/)(.+?)"/g;
    //       let matches;
    //       while ((matches = regex.exec(content))) {
    //         content = content.replace(`"${matches[1]}"`, `"${newsHost + matches[1]}"`);
    //       }
    //
    //       const link = el.find('link').text();
    //       const title = el.find('title').text();
    //       const author = el.find('dc\\:creator').text();
    //
    //       // Generate article.
    //       articles.push(
    //         {
    //           link,
    //           title,
    //           date,
    //           author,
    //           content,
    //           comments,
    //           commentsLink: `${link}#comments`,
    //         },
    //       );
    //     }
    //     resolve({
    //       articles,
    //     });
    //   },
    //   timeout: 2500,
    // }).catch((err) => {
    //   resolve({
    //     articles: null,
    //   });
    // });
  });
}
