const ConfigManager = require('./configmanager');
const LoggerUtil = require('./loggerutil');
const Mojang = require('./mojang');

const logger = LoggerUtil('%c[AuthManager]', 'color: #a02d2a; font-weight: bold');
const loggerSuccess = LoggerUtil('%c[AuthManager]', 'color: #209b07; font-weight: bold');

/**
 * Add an account.
 *
 * @param {string} login The account username (email if migrated).
 * @param {string} password The account password.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addAccount = async function (login, password) {
  try {
    const session = await Mojang.authenticate(login, password, ConfigManager.getClientToken());
    if (session.token) {
      // TODO: add displayUsername
      const username = session.username ? session.username : login;

      const ret = ConfigManager.addAuthAccount(session.uuid, session.token, username, username);

      if (ConfigManager.getClientToken() == null) {
        ConfigManager.setClientToken(session.clientToken);
      }

      ConfigManager.save();
      return ret;
    }

    throw new Error('NotPaidAccount');
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Remove an account. This will invalidate the access token associated
 * with the account and then remove it from the database.
 *
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeAccount = async (uuid) => {
  try {
    ConfigManager.removeAuthAccount(uuid);
    ConfigManager.save();

    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Validate the selected account with Mojang's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 *
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelected = async () => {
  const current = ConfigManager.getSelectedAccount();
  const isValid = await Mojang.validate(current.accessToken, ConfigManager.getClientToken());

  if (!isValid) {
    try {
      const session = await Mojang.refresh(current.accessToken, ConfigManager.getClientToken());
      ConfigManager.updateAuthAccount(current.uuid, session.accessToken);
      ConfigManager.save();
    } catch (err) {
      logger.debug('Error while validating selected profile:', err);
      if (err && err.error === 'ForbiddenOperationException') {
        // What do we do?
      }
      logger.log('Account access token is invalid.');
      return false;
    }
    loggerSuccess.log('Account access token validated.');
    return true;
  }
  loggerSuccess.log('Account access token validated.');
  return true;
};
