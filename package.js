Package.describe({
  summary: "Add profile.online field and real-time updates to Meteor.users."
});

Package.on_use( function(api) {
    api.use('accounts-base');
    api.use('coffeescript');
    api.add_files('user_status.coffee', 'server');

    api.export(['UserSessions', 'UserStatus'], 'server');
});

Package.on_test( function(api) {
    api.use('user-status');

    // Why do we have to repeat ourselves here, and not able to use api.imply?
    api.use(['accounts-base', 'accounts-password']);
    api.use('coffeescript');

    api.use('test-helpers');
    api.use('tinytest');

    api.add_files("tests/insecure_login.js");
    api.add_files('tests/status_tests.coffee');
});
