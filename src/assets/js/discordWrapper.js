// Work in progress
const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold');

const { Client } = require("discord-rpc");

const rpc = new Client({
   transport: 'ipc',
});

let activity = {
   details: 'Ожидает загрузки лаунчера',
   startTimestamp: new Date(),
   largeImageKey: `logo`,
};

function setActivity(newActivity) {
   activity = newActivity;
}

function getActivity() {
   return activity;
}

function init() {
   rpc.on("ready", () => {
      rpc.setActivity(activity);

      logger.log("Rich Prescence is on: " + rpc.user.username);
   });

   rpc.login({
      clientId: `657878741703327754`,
   });
}

function render() {
   console.log(activity)
   rpc.setActivity(activity);
}

module.exports = {
   render, init, setActivity, getActivity
}
