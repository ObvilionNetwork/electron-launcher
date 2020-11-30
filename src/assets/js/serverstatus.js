const net = require('net');

/**
 * Retrieves the status of a minecraft server.
 *
 * @param {string} address The server address.
 * @param {number} port Optional. The port of the server. Defaults to 25565.
 * @returns {Promise.<Object>} A promise which resolves to an object containing
 * status information.
 */
exports.getStatus = (address, port = 25565) => {
  if (typeof port === 'string') {
    port = parseInt(port, 10);
  }

  return new Promise((resolve, reject) => {
    const socket = net.connect(port, address, () => {
      const buff = Buffer.from([0xFE, 0x01]);
      socket.write(buff);
    });

    socket.setTimeout(2500, () => {
      socket.end();
      // eslint-disable-next-line prefer-promise-reject-errors
      reject({
        code: 'ETIMEDOUT',
        errno: 'ETIMEDOUT',
        address,
        port,
      });
    });

    socket.on('data', (data) => {
      if (!data) {
        const serverInfo = data.toString().split('\x00\x00\x00');
        const NUM_FIELDS = 6;
        if (serverInfo != null && serverInfo.length >= NUM_FIELDS) {
          resolve({
            online: true,
            version: serverInfo[2].replace(/\u0000/g, ''),
            motd: serverInfo[3].replace(/\u0000/g, ''),
            onlinePlayers: serverInfo[4].replace(/\u0000/g, ''),
            maxPlayers: serverInfo[5].replace(/\u0000/g, ''),
          });
        } else {
          resolve({
            online: false,
          });
        }
      }
      socket.end();
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
      // ENOTFOUND = Unable to resolve.
      // ECONNREFUSED = Unable to connect to port.
    });
  });
};
