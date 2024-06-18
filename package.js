/* eslint-disable no-undef */

Package.describe({
  name: 'mizzao:user-status',
  summary: 'User connection and idle state tracking for Meteor',
  version: '2.0.0-beta.1',
  git: 'https://github.com/Meteor-Community-Packages/meteor-user-status.git'
});

Package.onUse((api) => {
  api.versionsFrom(['2.8.1', '2.15', '3.0-rc.4']);

  api.use('ecmascript');
  api.use('accounts-base');
  api.use('check');
  api.use('mongo');
  api.use('ddp');
  api.use('tracker', 'client');
  api.use('mizzao:timesync@0.5.5');

  api.export('MonitorInternals', 'client', {
    testOnly: true
  });
  api.export('StatusInternals', 'server', {
    testOnly: true
  });

  api.mainModule('client/monitor.js', 'client');
  api.mainModule('server/status.js', 'server');

});

Package.onTest((api) => {
  api.use('ecmascript');
  api.use('mizzao:user-status');
  api.use('mizzao:timesync@0.5.5');

  api.use(['accounts-base', 'accounts-password']);

  api.use(['random', 'tracker']);

  api.use('test-helpers');
  api.use('tinytest');

  api.addFiles('tests/insecure_login.js');
  api.addFiles('tests/setup.js');
  // Just some unit tests here. Use the test app otherwise.
  api.addFiles('tests/monitor_tests.js', 'client');
  api.addFiles('tests/status_tests.js', 'server');

  api.addFiles('tests/server_tests.js', 'server');
  api.addFiles('tests/client_tests.js', 'client');
});
