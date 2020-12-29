const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");

class FileUt {
   filePath = '';

   /**
    * Creates a new File instance by converting the given pathname string into an abstract pathname.
    * If the given string is the empty string, then the result is the empty abstract pathname.
    * @param filePath {string}
    */
   constructor(filePath = '') {
      this.filePath = path.normalize(filePath);
   }

   /**
    * Tests whether the file or directory denoted by this pathname exists.
    * @returns {boolean}
    */
   exists() {
      return fs.existsSync(this.filePath);
   }

   /**
    * Converts this abstract pathname into a pathname string.
    * The resulting string uses the default name-separator character to separate the names in the name sequence.
    * @returns {string}
    */
   getPath() {
      return path.resolve(this.filePath);
   }

   /**
    * Returns the absolute pathname string of this pathname.
    * @returns {string}
    */
   getAbsolutePath() {
      return this.filePath;
   }

   getFiles() {
      if (!this.isDirectory()) return [];

      const files = fs.readdirSync(this.filePath);

      return files.map((file) => {
         return new FileUt(path.join(this.filePath, file));
      });
   }

   getAllFiles() {
      if (!this.isDirectory()) return [];

      const allFiles = [];
      const files = fs.readdirSync(this.filePath).map((file) => {
         return new FileUt(path.join(this.filePath, file));
      });

      files.forEach(file => {
         if (file.isFile()) return allFiles.push(file);

         file.getAllFiles().forEach(file2 => {
            return allFiles.push(file2);
         });
      });

      return allFiles;
   }

   /**
    * Tests whether the file denoted by this pathname is a directory.
    * @returns {boolean}
    */
   isDirectory() {
      return fs.lstatSync(this.filePath).isDirectory();
   }

   /**
    * Tests whether the file denoted by this pathname is a normal file.
    * @returns {boolean}
    */
   isFile() {
      return fs.lstatSync(this.filePath).isFile();
   }

   /**
    * Tests whether the file named by this pathname is a hidden file
    * @returns {Promise<boolean>}
    */
   isHidden() {
      return new Promise((resolve, reject) => {
         if (process.platform === 'win32') {
            exec(`for /f %A in ("${this.getPath()}") do echo %~aA`, (e, stdout, stderr) => {
               if (e) reject(e);
               if (stderr) reject(stderr);

               return resolve(stdout.split('echo')[1].split('')
                  .indexOf('h') !== -1
               );
            });
         } else {
            return resolve((/(^|\/)\.[^\/\.]/g).test(path));
         }
      });
   }

   /**
    * Returns the time that the file denoted by this pathname was last modified.
    * @returns {Date}
    */
   lastModified() {
      return fs.statSync(this.filePath).mtime;
   }

   remove() {
      if (this.isDirectory()) {
         this.getAllFiles().forEach(file => {
            file.remove();
         });
      } else {
         return fs.unlinkSync(this.getAbsolutePath());
      }
   }

   size() {
      return fs.statSync(this.filePath).size;
   }

   asyncSize() {
      return new Promise((resolve, reject) => {
         fs.stat(this.filePath, (e, stats) => {
            return resolve(stats.size);
         });
      });
   }
}

module.exports = FileUt;
