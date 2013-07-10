define(['woodman'], function (woodman) {
  return function (runtime, params, callback) {

    var logger = woodman.getLogger('add-on push xcodeproj');
    logger.log('started');

    /**
     * Copy the Urban Airship library to the xcode projects' directory
     *
     * @function
     * @param {function} cb Callback
     */
    function copyLibraryToProject(cb) {
      var iOSLibrary = './urban-airship/ios/lib';
      var libDest = 'Airship';

      runtime.copyFromAddon(iOSLibrary, libDest, function (err) {
        if (err) {
          logger.warn('copyLibraryToProject copyFromAddonToProject error', err);
        } else {
          logger.log('copyLibraryToProject OK!');
        }

        cb(err, libDest);
      });
    }

    /**
     * Updates xcode projects' header search paths with the Urban Airship library
     *
     * @function
     * @param {string}   libDest The path to the library (relative
     *  to the xcode projects' app directory)
     * @param {function} cb Callback
     */
    function updateHeaderSearchPaths(libDest, cb) {
      runtime.addHeaderSearchPath(libDest, true, function (err) {
        if (err) {
          logger.warn('updateHeaderSearchPaths addHeaderSearchPath error', err);
        } else {
          logger.log('updateHeaderSearchPaths OK!');
        }

        cb(err);
      });
    }

    /**
     * Adds the Urban Airship library to the projects' header search path
     * first copy the lib to the xcode projects' app directory then update
     * the header search paths.
     *
     * @function
     * @param {function} cb Callback
     */
    function addLibraryToHeaderSearchPaths(cb) {
      runtime.async.waterfall([
        copyLibraryToProject,
        updateHeaderSearchPaths
      ], function (err) {
        if (err) {
          logger.warn('addLibraryToHeaderSearchPaths async.waterfall error', err);
        } else {
          logger.log('addLibraryToHeaderSearchPaths OK!');
        }

        cb(err);
      });
    }

    /**
     * Updates the Urban Airship config file (Resources/AirshipConfig.plist)
     *
     * @function
     * @param {function} cb Callback
     */
    function updateUAConfig(cb) {
      var envtype = params.envtype;
      logger.log('updateUAConfig envtype', envtype);
      var dev = true;
      var err;

      if (envtype === 'live' || envtype === 'staging') {
        dev = false;
      } else if (envtype === 'debug') {
        dev = true;
      } else {
        err = new Error('envtype ' + envtype + ' is not recognized');
        logger.warn('updateUAConfig error', err);
        cb(err);
        return;
      }

      var options = params.options;
      if (!options) {
        err = new Error('no options parameters.. can\'t retrieve app key/secrets');
        logger.warn('updateUAConfig error', err);
        cb(err);
      }

      var prefix = dev ? 'dev' : 'prod';
      var appKey    = options[prefix + '-app-key'];
      var appSecret = options[prefix + '-app-secret'];
      // check if these aren't undefined...

      prefix = dev ? 'DEVELOPMENT' : 'PRODUCTION';
      var replaceMap = {};
      replaceMap['__APP_STORE_OR_AD_HOC_BUILD__'] = dev ? 'NO' : 'YES';
      replaceMap['__' + prefix + '_APP_KEY__']    = '"' + appKey    + '"';
      replaceMap['__' + prefix + '_APP_SECRET__'] = '"' + appSecret + '"';

      logger.log('updateUAConfig replaceMap', replaceMap);

      var configFilePath = './Resources/AirshipConfig.plist';

      runtime.multipleReplaceInFile(configFilePath, replaceMap, function (err) {
        if (err) {
          logger.warn('updateUAConfig multipleReplaceInFile error', err);
        } else {
          logger.log('updateUAConfig OK!');
        }

        cb(err);
      });
    }

    /**
     * the last two methods need plugman.install to have run (for all the files
     * to be available in the xcode project)
     * these last two methods could be executed in parallel but a single async.series
     * is better for simplicity
     */
    runtime.async.series([
      addLibraryToHeaderSearchPaths,
      updateUAConfig
    ], function (err) {
      if (err) {
        logger.warn('main async.series error', err);
      } else {
        logger.log('DONE');
      }

      callback(err);
    });
  };
});