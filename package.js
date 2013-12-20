Package.describe({
  summary: "Add profile.online field and real-time updates to Meteor.users."
});

Package.on_use( function(api) {
    api.use('accounts-base', ['client','server']);
    api.use('coffeescript', 'server');
    api.add_files('user_status.coffee', 'server');

    api.export(['UserSessions', 'UserStatus'], 'server');
});

Package.on_test( function(api) {
    api.use('user-status');
    api.use('test-helpers');
    api.use('tinytest');

    // TODO add test cases
});
