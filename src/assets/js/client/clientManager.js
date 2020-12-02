const fs = require('fs');
const path = require('path');
const request = require('request');

const ConfigManager = require('../configmanager');
const logger = require('../loggerutil')('%c[DistroManager]', 'color: #a02d2a; font-weight: bold');

let config = null;

function init() {
   return new Promise((resolve, reject) => {
      const distroURL = 'https://obvilionnetwork.ru/api/servers/info';

      const opts = {
         url: distroURL,
         timeout: 2500,
      };

      const distroDest = path.join(ConfigManager.getLauncherDirectory(), 'clients.json');

      const temp = {
         servers: [
            {
               name: 'HiTech',
               id: 'hitech',
               description: 'test',
               version: '1.7.10',
               icon: 'https://cdn.discordapp.com/icons/652249606599737391/588419cb59d8ece0062a3f1dc6b88751.png?size=512',
               address: 'obvilionnetwork.ru:25565',
            },
            {
               name: 'Test',
               id: 'test',
               description: 'test',
               version: '1.7.10',
               icon: 'https://im0-tub-by.yandex.net/i?id=de283b281aa17181aab5115b594978cc&n=13&exp=1',
            },
         ]
      }

      request(opts, (error, resp, body) => {
         if (!error) {
            fs.writeFile(distroDest, temp, 'utf-8', (err) => {
               if (!err) {
                  config = temp;
                  resolve(Distribution.fromJSON(temp));
               } else {
                  reject(err);
               }
            });

         } else {
            reject(error);
         }
      });
   });
}

class Client {
   static fromJSON(json) {
      return Object.assign(new Client(), json);
   }

   getID() {
      return this.id;
   }

   getName() {
      return this.name;
   }

   getDescription() {
      return this.description;
   }

   getVersion() {
      return this.version;
   }

   getIcon() {
      return this.icon;
   }

   getCore() {
      return this.core;
   }

   getLibraries() {
      return this.libraries;
   }

   getNatives() {
      return this.natives;
   }

   getMods() {
      return this.mods;
   }

   getServerIP() {
      return this.address;
   }
}

class Distribution {
   static fromJSON(json) {
      return Object.assign(new Distribution(), json);
   }

   getServer(id) {
      let server = null;
      this.servers.forEach(value => {
         if (value.id === id) {
            server = Client.fromJSON(value);
         }
      });

      return server;
   }

   getServers() {
      return config.servers.map(value => {
         return Client.fromJSON(value);
      })
   }
}

function getDistribution() {
   return Distribution.fromJSON(config);
}

module.exports = { init, config, getDistribution }
