Package.describe({
  summary: "Add profile.online field and real-time updates to Meteor.users."
});

Package.on_use( function(api) {
    api.use('accounts-base', ['client','server']);
    api.use('coffeescript', 'server');
    api.add_files('user_status_server.coffee', 'server');
    api.add_files('user_status_client.coffee', 'client');
});

