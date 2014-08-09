Package.describe({
  summary: "User connection and idle state tracking for Meteor",
  version: "0.6.1",
  git: "https://github.com/mizzao/meteor-user-status.git"
});

Package.onUse( function(api) {
  api.versionsFrom("METEOR-CORE@0.9.0-atm");

  api.use('accounts-base');
  api.use(['coffeescript', 'underscore']);

  api.use(['deps', 'jquery'], 'client');

  // 0.2.2 is the first 0.9-compatible version
  api.use('mizzao:timesync@>=0.2.2');

  api.add_files('monitor.coffee', 'client');
  api.add_files('status.coffee', 'server');

  api.export('UserStatus'); // on both

  api.export('MonitorInternals', 'client', {testOnly: true});
  api.export('StatusInternals', 'server', {testOnly: true});
});

Package.onTest( function(api) {
  api.use('mizzao:user-status');
  api.use('mizzao:timesync');

  // Why do we have to repeat ourselves here, and not able to use api.imply?
  api.use(['accounts-base', 'accounts-password']);
  api.use(['coffeescript', 'underscore']);

  api.use('test-helpers');
  api.use('tinytest');

  api.add_files("tests/insecure_login.js");
  api.add_files('tests/setup.coffee');
  // Just some unit tests here. Use the test app otherwise.
  api.add_files('tests/monitor_tests.coffee', 'client');
  api.add_files('tests/status_tests.coffee', 'server');

  api.add_files('tests/server_client_tests.coffee');
});
