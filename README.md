# meteor-user-status

Keeps track of user connection state and makes this available in `Meteor.users`.

## Usage

```sh
$ mrt add user-status
```

The `profile.online` field will be updated automatically if the user logs in or logs out, closes their browser, or otherwise disconnects.
 (anonymous users are not tracked.)

To use this reactively, you can create a publication on the server:

```coffeescript
Meteor.publish "userStatus", ->
  Meteor.users.find { "profile.online": true },
    fields: { ... }
```

Or, if you are already pushing all users to the client, use a reactive template:

```coffeescript
Template.foo.usersOnline = ->
  Meteor.users.find({ "profile.online": true })
```

Check out https://github.com/mizzao/meteor-accounts-testing for a simple accounts drop-in that you can use to test your app.
