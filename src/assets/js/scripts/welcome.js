/**
 * Script for welcome.ejs
 */
document.getElementById('welcomeButton').addEventListener('click', (e) => {
  switchView(VIEWS.welcome, VIEWS.login);
  setTimeout(() => {
    frameBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  }, 540);
});
