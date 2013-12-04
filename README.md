# meteor-user-status

Keeps track of user connection state and makes this available in `Meteor.users` as well as some other objects.

## What's this do?

Tracks users that are online and allows you to use them in useful ways, such as rendering the users online box below showing yourself in orange and other online users in green:

![User online states](https://raw.github.com/mizzao/meteor-user-status/master/docs/example.png)

## Usage

Install the smart package using **[meteorite](https://github.com/oortcloud/meteorite)**:

```sh
$ mrt add user-status
```

The `profile.online` field will be updated automatically if the user logs in or logs out, closes their browser, or otherwise disconnects.
 (anonymous users are not tracked.)

Use a reactive cursor, such as by creating a publication on the server:

```coffeescript
Meteor.publish "userStatus", ->
  Meteor.users.find { "profile.online": true },
    fields: { ... }
```

or you can use this to do things when users go online and offline (however, usually you should just be as reactive as possible):

```coffeescript
Meteor.users.find({ "profile.online": true }).observe
  added: (id) ->
    # id just came online
    
  removed: (id) ->
    # id just went offline
```

You can use a reactive cursor to select online users either in a `publish` function or a template helper:

```coffeescript
Template.foo.usersOnline = ->
  Meteor.users.find({ "profile.online": true })
```

Making this directly available on the client allows for useful template renderings of user state. For example, with something like the following you get the picture above (using bootstrap classes).

```
<template name="userPill">
    <span class="label {{labelClass}}">{{username}}</span>
</template>
```

```coffeescript
Template.userPill.labelClass = ->
  if @_id is Meteor.userId()
    "label-warning"
  else if @profile?.online
    "label-success"
  else ""
```

## Advanced Usage

The `UserSessions` (anonymous) collection contains a `userId` and `ipAddr` field for each logged in session (stored in `_id`).
You can use this to check the IP address of any connected user. We don't keep this in `Meteor.users` because that would
incur extra database hits and require unnecessary additional cleanup.

The `UserStatus` object is an `EventEmitter` on which you can listen for sessions logging in and out.
Logging out includes closing the browser; opening the browser will trigger a new login event.

```coffeescript
UserStatus.on "sessionLogin", (userId, sessionId, ipAddr) ->
  console.log(userId + " with session " + sessionId + " logged in from " + ipAddr)

UserStatus.on "sessionLogout", (userId, sessionId) ->
  console.log(userId + " with session " + sessionId + " logged out")
```

This will print out stuff like the following:
```
RsuCmaNLa6CXAR9dS with session t6acwNizuWuJdL8rC logged in from 192.168.56.1
Rrp6yezq9iZJhipg3 with session TPnT28aCnaQGzavay logged in from 192.168.56.1
Rrp6yezq9iZJhipg3 with session TPnT28aCnaQGzavay logged out
Rrp6yezq9iZJhipg3 with session XReS3mqDZEKD9tTKW logged in from 192.168.56.1
```

Check out https://github.com/mizzao/meteor-accounts-testing for a simple accounts drop-in that you can use to test your app.

## Contributors

* Andrew Mao (https://github.com/mizzao/)
* Rafael Sales (https://github.com/rafaelsales)
* Jonathan James (https://github.com/jonjamz)
