const fs = require('fs');
const path = require('path');
const http = require('https');
const request = require('request');

const { spawn } = require('child_process');

const ConfigManager = require('../configmanager');
const FileUt = require('../utils/File');
const logger = require('../loggerutil')('%c[ClientManager]', 'color: #a02d2a; font-weight: bold');

let config = null;

function init() {
   logger.info('Загрузка серверов...')
   return new Promise((resolve, reject) => {
      const distroURL = 'http://obvilionnetwork.ru/api/servers/info';

      const opts = {
         url: distroURL,
         timeout: 60000,
      };

      const distroDest = path.join(ConfigManager.getLauncherDirectory(), 'clients.json');

      request.get(distroURL, opts, (error, resp, body) => {
         if (!error) {
            config = JSON.parse(body);
            fs.writeFile(distroDest, config, 'utf-8', (err) => {
               if (!err) {
                  resolve(Distribution.fromJSON(config));
               } else {
                  reject(err);
               }
            });
         } else {
            logger.warn('Ошибка загрузки серверов');
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

   getOther() {
      return this.other;
   }

   getAssets() {
      return this.assets;
   }

   getJava() {
      return this.java;
   }

   getServerIP() {
      return this.address;
   }

   getJavaVersion() {
      return this.javaVersion;
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
   onExit = [];

   /** @type {Client} */
   client = null;

   constructor(client) {
      this.client = client;
      this.clientDir = path.join(ConfigManager.getInstanceDirectory(), this.client.getName());
      this.assetsDir = path.join(ConfigManager.getInstanceDirectory(), 'assets', this.client.getVersion());
   }

   async start() {
      this.onStart.forEach(c => c());

      if (!fs.existsSync(ConfigManager.getDataDirectory())) {
         fs.mkdirSync(ConfigManager.getDataDirectory());
         fs.mkdirSync(ConfigManager.getCommonDirectory());
         fs.mkdirSync(ConfigManager.getInstanceDirectory());
      }

      if (!fs.existsSync(this.clientDir)) {
         fs.mkdirSync(this.clientDir);
      }

      this.clientSize = 0;

      this.client.getNatives().forEach((module) => {
         this.clientSize += module.size;
      });
      this.client.getLibraries().forEach((module) => {
         this.clientSize += module.size;
      });
      this.client.getAssets().forEach((module) => {
         this.clientSize += module.size;
      });
      this.client.getMods().forEach((module) => {
         this.clientSize += module.size;
      });

      this.realClientSize = await this.getModuleSize(this.client.getMods(), 'mods');
      this.realClientSize += await this.getModuleSize(this.client.getAssets(), '../assets');
      this.realClientSize += await this.getModuleSize(this.client.getLibraries(), 'libraries');
      this.realClientSize += await this.getModuleSize(this.client.getNatives(), 'natives');

      await this.check();

      logger.info('Downloading Core...');
      await this.download(this.client.getCore());

      logger.info('Downloading Natives...');
      await this.downloadAll(this.client.getNatives());

      logger.info('Downloading Libraries...');
      await this.downloadAll(this.client.getLibraries());

      if (!new FileUt(path.join(this.clientDir, 'mods')).exists()) {
         logger.info('Downloading Config files...');
         await this.downloadAll(this.client.getOther());
      }

      logger.info('Downloading Mods...');
      await this.downloadAll(this.client.getMods());

      logger.info('Downloading Assets...');
      await this.downloadAll(this.client.getAssets());


      if (!fs.existsSync(path.join(ConfigManager.getJavaExecutable(), 'bin', process.platform === 'win32' ? '\\java.exe' : '/java'))) {
         if (process.platform === 'win32') {
            if (process.arch === 'x64') {
               logger.info('Downloading Java for Windows x64...');
               await this.downloadAll(this.client.getJava().windows64);
            } else {
               logger.info('Downloading Java for Windows x32...');
               await this.downloadAll(this.client.getJava().windows32);
            }
         }

         if (process.platform === 'linux') {
            logger.info('Downloading Java for Linux x64...');
            await this.downloadAll(this.client.getJava().linux64);

            exec('chmod +x java', {
               cwd: path.join(ConfigManager.getCommonDirectory(), 'java', this.client.getJavaVersion(), 'bin'),
            });
         }

         ConfigManager.setJavaExecutable(path.join(ConfigManager.getCommonDirectory(), 'java', this.client.getJavaVersion()));
      }

      await this.check();

      this.onComplete.forEach(c => c());

      const text = this.getCMD().join(' ').replace(ConfigManager.getSelectedAccount().accessToken, 'deleted');
      logger.log(text);

      fs.writeFileSync(path.join(this.clientDir, 'latest.log'), text + '\n');

      const out = fs.openSync(path.join(this.clientDir, 'latest.log'), 'a');
      const err = fs.openSync(path.join(this.clientDir, 'latest.log'), 'a');

      const args = this.getCMD();
      const cmd = this.getCMD()[0];

      args.splice(0, 1);

      const child = spawn(cmd, args, {
         cwd: this.clientDir,
         detached: true,
         stdio: [ 'ignore', out, err ]
      });

      child.on('exit', (code, signal) => {
         console.log('Child exited with code: ' +code+' and signal: '+signal);
         this.onExit.forEach(c => c())
      });

      child.unref();


      /* Лимит логов 1МБ */

      // exec(this.getCMD(), {
      //       cwd: this.clientDir,
      //       detached: true,
      //       stdio: [ 'ignore', out, err ]
      //    },
      //    (err, stdout, stderr) => {
      //       this.check();
      //       //console.log(`stdout: ${stdout}`);
      //       //console.log(`stderr: ${stderr}`);
      //    })
      //    .addListener('exit', (code, signal) => {
      //       console.log('Child exited with code ' + code + ' and signal ' + signal);
      //        this.onExit.forEach(c => c())
      //    });
      //
   }

   async checkPercent() {
      const perc = this.realClientSize / this.clientSize * 100;
      return Math.round(perc);
   }

   async getModuleSize(modules, name) {
      let size = 0;

      const moduleDir = new FileUt(path.join(this.clientDir, name));

      if (!moduleDir.exists()) return size;

      const files = moduleDir.getAllFiles();
      for (const file of files) {
         for (const module of modules) {
            const moduleFile = new FileUt(path.join(this.clientDir, module.path));

            if (moduleFile.getAbsolutePath() === file.getAbsolutePath()) {
               size += await file.asyncSize();
            }
         }
      }

      return size;
   }

   async check() {
      logger.info('Checking files...');
      await this.checkModules(this.client.getMods(), 'mods');
      await this.checkModules(this.client.getNatives(), 'natives');
      await this.checkModules(this.client.getLibraries(), 'libraries');
      await this.checkModules(this.client.getAssets(), '../assets');
   }

   getCMD() {
      let cmd = [];

      cmd.push( path.join(ConfigManager.getJavaExecutable(), 'bin', process.platform === 'win32' ? '\\java.exe' : '/java') );

      cmd.push( `-Xms${ConfigManager.getMinRAM()}` );
      cmd.push( `-Xmx${ConfigManager.getMaxRAM()}` );
      cmd.push( `-Djava.library.path=${path.join(this.clientDir, 'natives')}` );
      cmd.push( `-cp`, `${this.getClasspath()}` );
      cmd.push( `-Duser.language=en` );

      cmd.push( `net.minecraft.launchwrapper.Launch` );

      cmd.push( `--username`, `${ConfigManager.getSelectedAccount().username}` );
      cmd.push( `--version`, `${this.client.getCore().type} ${this.client.getVersion()}` );
      cmd.push( `--gameDir`, `${this.clientDir}` );
      cmd.push( `--assetsDir`, `${this.assetsDir}` );
      cmd.push( `--assetIndex`, `${this.client.getVersion()}` );
      cmd.push( `--uuid`, `${ConfigManager.getSelectedAccount().uuid}` );
      cmd.push( `--accessToken`, `${ConfigManager.getSelectedAccount().accessToken}` );
      cmd.push( "--userProperties", "[]" );
      cmd.push( "--userType", "legacy" );
      cmd.push( "--tweakClass", this.client.getVersion() === "1.7.10" ? "cpw.mods.fml.common.launcher.FMLTweaker" : "net.minecraftforge.fml.common.launcher.FMLTweaker");

      return cmd;
   }

   getClasspath() {
      const libFiles = path.join(this.clientDir, 'libraries');
      const libs = fs.readdirSync(libFiles);

      let cpSeparator = process.platform === 'win32' ? ';' : ':';

      let cp = '';

      for (const lib of libs) {
         const stats = fs.statSync(path.join(libFiles, lib));
         if (stats.isFile()) {
            cp += path.join(libFiles, lib) + cpSeparator
         } else {
            const libs2 = fs.readdirSync(path.join(libFiles, lib));
            for (const lib2 of libs2) {
               cp += path.join(libFiles, lib, lib2) + cpSeparator
            }
         }
      }

      cp += path.join(this.clientDir, 'forge.jar') + cpSeparator;
      cp += path.join(this.clientDir, 'minecraft.jar') + cpSeparator;

      return cp;
   }

   async checkModules(modules, name) {
      const moduleDir = new FileUt(path.join(this.clientDir, name));
      if (!moduleDir.exists()) return false;

      const files = moduleDir.getAllFiles();
      for (const file of files) {
         let ok = false;

         for (const module of modules) {
            const moduleFile = new FileUt(path.join(this.clientDir, module.path));

            if (moduleFile.getAbsolutePath() === file.getAbsolutePath()) {
               if (await file.asyncSize() === module.size) ok = true;
            }
         }

         if (!ok) file.remove();
      }
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

         this.onDownload.forEach((c) => c(module));
         const request = http.get('https://obvilionnetwork.ru/api/files/' + module.link, response => {
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
            this.realClientSize += module.size;
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

         case 'exit':
            this.onExit.push(callback);
            break;
      }

   }
}

function getDistribution() {
   return Distribution.fromJSON(config);
}

module.exports = { init, config, getDistribution, ClientDownloader }
