const fs = require('fs');
const path = require('path');
const http = require('https');
const request = require('request');

const ConfigManager = require('../configmanager');
const logger = require('../loggerutil')('%c[ClientManager]', 'color: #a02d2a; font-weight: bold');

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
               core: {
                  link: 'https://obvilionnetwork.ru/api/files/clients/HiTech/forge.jar',
                  path: 'forge.jar',
                  size: 3018833,
                  type: 'Forge'
               },
               libraries: [
                  {
                     link: 'https://obvilionnetwork.ru/api/files/clients/HiTech/libraries/authlib-1.5.16.jar',
                     path: 'libraries/authlib-1.5.16.jar',
                     size: 61936,
                  },
                  {
                     link: 'https://obvilionnetwork.ru/api/files/clients/HiTech/libraries/codecjorbis-20101023.jar',
                     path: 'libraries/codecjorbis-20101023.jar',
                     size: 103871,
                  },
               ],
               natives: [
                  {
                     link: 'https://obvilionnetwork.ru/api/files/clients/HiTech/natives/OpenAL32.dll',
                     path: 'natives/OpenAL32.dll',
                     size: 390144,
                  },
               ],
               mods: [
                  {
                     link: 'https://obvilionnetwork.ru/api/files/clients/HiTech/mods/advancedmachinesas-1.7.10.jar',
                     path: 'mods/advancedmachinesas-1.7.10.jar',
                     size: 390144,
                  },
               ]
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
                  config = JSON.parse(body);
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

class ClientDownloader {
   onComplete = [];
   onStart = [];
   onDownload = [];
   onError = [];

   /** @type {Client} */
   client = null;

   constructor(client) {
      this.client = client;
      this.clientDir = path.join(ConfigManager.getInstanceDirectory(), this.client.getName());
   }

   async start() {
      this.onStart.forEach(c => {
         c();
      });

      if (!fs.existsSync(this.clientDir)) {
         fs.mkdirSync(this.clientDir);
      }

      logger.info('Downloading Core...');
      await this.download(this.client.getCore());

      logger.info('Downloading Libraries...');
      await this.downloadAll(this.client.getLibraries());

      logger.info('Downloading Natives...');
      await this.downloadAll(this.client.getNatives());

      logger.info('Downloading Mods...');
      await this.downloadAll(this.client.getMods());

      this.onComplete.forEach(c => {
         c();
      });
   }

   async downloadAll(modules) {
      for (const module of modules) {
         await this.download(module);
      }
   }

   download(module) {
      return new Promise((resolve, reject) => {
         let dest = this.clientDir;

         const arr = module.path.split('/');
         arr.forEach((value, index) => {
            if (index + 1 < arr.length)
            if (!fs.existsSync(path.join(dest, value))) {
               fs.mkdirSync(path.join(dest, value));
            }
            dest = path.join(dest, value);
         });

         if (fs.existsSync(dest))
            if (fs.statSync(dest).size === module.size) {
               return resolve();
            } else {
               fs.unlink(dest, () => {});
            }

         const file = fs.createWriteStream(dest, { flags: "wx" });

         this.onDownload.forEach((c) => {
            c(module);
         });
         const request = http.get(module.link, response => {
            if (response.statusCode === 200) {
               response.pipe(file);
            } else {
               file.close();
               fs.unlink(dest, () => {}); // Delete temp file
               reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
            }
         });

         request.on("error", err => {
            file.close();
            fs.unlink(dest, () => {}); // Delete temp file
            reject(err.message);
         });

         file.on("finish", () => {
            resolve();
         });

         file.on("error", err => {
            logger.log(err.code)
            file.close();

            if (err.code === "EEXIST") {
               reject("File already exists");
            } else {
               fs.unlink(dest, () => {}); // Delete temp file
               reject(err.message);
            }
         });
      });
   }

   on(type, callback) {
      switch (type) {
         case 'complete':
            this.onComplete.push(callback);
            break;

         case 'start':
            this.onStart.push(callback);
            break;

         case 'error':
            this.onError.push(callback);
            break;

         case 'download':
            this.onDownload.push(callback);
            break;
      }

   }
}

function getDistribution() {
   return Distribution.fromJSON(config);
}

module.exports = { init, config, getDistribution, ClientDownloader }
