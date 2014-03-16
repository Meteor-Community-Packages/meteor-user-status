Package.describe({
  summary: "User connection and idle state tracking for Meteor"
});

Package.on_use( function(api) {
    api.use('accounts-base');
    api.use(['coffeescript', 'underscore']);

    api.use(['deps', 'jquery'], 'client');

    api.use('timesync'); // For accurate idle measurements

    api.add_files('monitor.coffee', 'client');
    api.add_files('status.coffee', 'server');

    api.export('UserStatus'); // on both

    api.export('MonitorInternals', 'client', {testOnly: true});
    api.export('StatusInternals', 'server', {testOnly: true});
});

Package.on_test( function(api) {
    api.use('user-status');

    // Why do we have to repeat ourselves here, and not able to use api.imply?
    api.use(['accounts-base', 'accounts-password']);
    api.use('coffeescript');

    api.use('test-helpers');
    api.use('tinytest');

    api.add_files("tests/insecure_login.js");
    api.add_files('tests/setup.coffee', 'server');
    // Just some unit tests here. Use the test app otherwise.
    api.add_files('tests/monitor_tests.coffee', 'client');
    api.add_files('tests/status_tests.coffee', 'server');

    api.add_files('tests/server_client_tests.coffee');
});
