Package.describe({
  summary: "Add profile.online field and real-time updates to Meteor.users."
});

var both = ['client', 'server'];

Package.on_use( function(api) {
    api.use('accounts-base', ['client','server']);
    api.use('coffeescript', 'server');
    api.add_files('user_status.coffee', 'server');
});

Package.on_test( function(api) {
    api.use('user-status', both);
    api.use('test-helpers', both);
    api.use('tinytest', both);

    // TODO add test cases
});
