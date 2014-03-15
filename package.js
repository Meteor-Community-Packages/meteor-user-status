Package.describe({
  summary: "User connection and idle state tracking for Meteor"
});

Package.on_use( function(api) {
    api.use('accounts-base');
    api.use('coffeescript');

    api.use(['deps', 'jquery'], 'client');

    api.use('timesync'); // For accurate idle measurements

    api.add_files('monitor.coffee', 'client');
    api.add_files('status.coffee', 'server');

    api.export('UserStatus'); // on both
    api.export('MonitorInternals', 'client', {testOnly: true}); // on both
});

Package.on_test( function(api) {
    api.use('user-status');

    // Why do we have to repeat ourselves here, and not able to use api.imply?
    api.use(['accounts-base', 'accounts-password']);
    api.use('coffeescript');

    api.use('test-helpers');
    api.use('tinytest');

    api.add_files("tests/insecure_login.js");
    // Just some unit tests here. Use the test app otherwise.
    api.add_files('tests/monitor_tests.coffee', 'client');
    api.add_files('tests/status_tests.coffee');
});
