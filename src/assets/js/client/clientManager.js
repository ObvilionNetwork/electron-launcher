const fs = require('fs');
const path = require('path');
const request = require('request');

const ConfigManager = require('../configmanager');
const Client = require('./client');
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
               id: 'hitech'
            }
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

class Distribution {
   static fromJSON(json) {
      return Object.assign(new Distribution(), json);
   }

   getServer(name) {
      let server = null;
      this.servers.forEach(value => {
         if (value.name === name) {
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
