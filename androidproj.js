define(['woodman'], function (woodman) {
  return function (runtime, params, callback) {

    var logger = woodman.getLogger('add-on push androidproj');
    logger.log('started');

    // should use path.sep rather than '/' ... don't want this to fail on MSWIN
    var packagePath = params.packagename.replace(/\./g, '/');

    /**
     * Invoke plugman.install on the android project
     *
     * @function
     * @param {function} cb Callback
     */
    function plugmanInstall(cb) {
      runtime.plugmanInstall('./urban-airship', function (err) {
        if (err) {
          logger.error('plugmanInstall error', err);
        } else {
          logger.log('we DONE');
        }

        cb(err);
      });
    }

    /**
     * Injects source code in MainApplication.java at various placeholders:
     *  - imports
     *  - onCreate
     *  - onStop
     *
     * TODO: prepend rather than replace the placeholders so we can potentially
     * inject more code.
     *
     * @function
     * @param {function} cb Callback
     */
    function injectInApplicationSrc(cb) {
      // 4 space indent
      var indent = '    ';

      var imports = [
        'import com.urbanairship.UAirship;',
        'import com.urbanairship.phonegap.plugins.PushNotificationPluginIntentReceiver;',
        'import com.urbanairship.push.PushManager;'
      ].join('\n');

      var onCreate = [
        'UAirship.takeOff(this);',
        'if (UAirship.shared().getAirshipConfigOptions().pushServiceEnabled) {',
        indent + 'PushManager.enablePush();',
        indent + 'PushManager.shared().setIntentReceiver(PushNotificationPluginIntentReceiver.class);',
        '}'
      ].map(function (s, i) {
        return (i ? indent + indent : '') + s;
      }).join('\n');

      var onStop = 'UAirship.land();';

      var replaceMap = {
        '\\/\\*\\*___JOSHFIRE_IMPORT_PLACEHOLDER___\\*\\*\\/'   : imports,
        '\\/\\*\\*___JOSHFIRE_ONCREATE_PLACEHOLDER___\\*\\*\\/' : onCreate,
        '\\/\\*\\*___JOSHFIRE_ONSTOP_PLACEHOLDER___\\*\\*\\/'   : onStop
      };

      // we should do something like 'prepend' so we can inject more...

      logger.log('injectInApplicationSrc replaceMap', replaceMap);

      var fpath = './src/' + packagePath + '/MainApplication.java';
      logger.log('injectInApplicationSrc fpath', fpath);

      runtime.multipleReplaceInFile(fpath, replaceMap, function (err) {
        if (err) {
          logger.warn('injectInApplicationSrc multipleReplaceInFile error', err);
        } else {
          logger.log('injectInApplicationSrc OK!');
        }

        cb(err);
      });
    }

    /**
     * Copies the Urban Airship config file (airshipconfig.properties)
     * to the android project (in assets directory)
     *
     * @function
     * @param {function} cb Callback
     */
    function copyUAConfigFileToProject(cb) {
      var UAplistFile = './urban-airship/android/assets/airshipconfig.properties.sample';
      var UAplistDestFile = './assets/airshipconfig.properties';

      runtime.copyFromAddon(UAplistFile, UAplistDestFile,  function (err) {
        if (err) {
          logger.warn('copyUAConfigFileToProject copyFromAddon error', err);
        } else {
          logger.log('copyUAConfigFileToProject OK!');
        }

        cb(err, UAplistDestFile);
      });
    }

    /**
     * Updates the Urban Airship config file (airshipconfig.properties)
     *
     * @function
     * @param {string}   configFilePath The path to the config file (relative
     *  to the android projects' directory)
     * @param {function} cb Callback
     */
    function updateUAConfigFile(configFilePath, cb) {
      var releasemode = params.releasemode;
      logger.log('updateUAConfigFile releasemode', releasemode);
      var dev = true;
      var err;

      if (releasemode !== undefined) {
        dev = !releasemode;
      } else {
        err = new Error('environment type (releasemode) is not recognized');
        logger.warn('updateUAConfigFile error', err);
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

      prefix = dev ? 'development' : 'production';
      var replaceMap = {};
      replaceMap['__gcmSender__']               = '633609568080';
      replaceMap['__' + prefix + 'AppKey__']    = appKey;
      replaceMap['__' + prefix + 'AppSecret__'] = appSecret;
      replaceMap['__inProduction__']            = dev ? 'false' : 'true';

      // inproduction...

      logger.log('updateUAConfigFile replaceMap', replaceMap);

      runtime.multipleReplaceInFile(configFilePath, replaceMap, function (err) {
        if (err) {
          logger.warn('updateUAConfigFile multipleReplaceInFile error', err);
        } else {
          logger.log('updateUAConfigFile OK!');
        }

        cb(err);
      });
    }

    /**
     * Update the PushNotificationPluginIntentReceiver class with the projects'
     * main activity name
     *
     * @function
     * @param {function} cb Callback
     */
    function updateSrcFile(cb) {
      var replaceMap = {
        '___JOSHFIREFACTORYACTIVITYNAME___' : params.activityname
      };

      var srcFilePath = './src/com/urbanairship/phonegap/plugins/PushNotificationPluginIntentReceiver.java';

      logger.log('updateSrcFile srcFilePath', srcFilePath);
      logger.log('updateSrcFile replaceMap', replaceMap);

      runtime.multipleReplaceInFile(srcFilePath, replaceMap, function (err) {
        if (err) {
          logger.warn('updateSrcFile multipleReplaceInFile error', err);
        } else {
          logger.log('updateSrcFile OK!');
        }

        cb(err);
      });
    }

    /**
     * Update the Urban Airship config.
     * first copy the config file it to the project then update it.
     *
     * @function
     * @param {function} cb Callback
     */
    function updateUAConfig(cb) {
      runtime.async.waterfall([
        copyUAConfigFileToProject,
        updateUAConfigFile
      ], function (err) {
        if (err) {
          logger.warn('updateUAConfig async.waterfall error', err);
        } else {
          logger.log('updateUAConfig OK!');
        }

        cb(err);
      });
    }

    /**
     * the last three methods need plugman.install to have run (for all the files
     * to be available in the android project)
     * these last three methods could be executed in parallel but a single async.series
     * is better for simplicity
     */
    runtime.async.series([
      plugmanInstall,
      injectInApplicationSrc,
      updateSrcFile,
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