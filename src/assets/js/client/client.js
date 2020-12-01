
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

module.exports = Client;
