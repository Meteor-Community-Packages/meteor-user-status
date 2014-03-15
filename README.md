# meteor-user-status

Keeps track of user connection state and makes this available in `Meteor.users` as well as some other objects.

Check out a demo app at http://user-status.meteor.com, or its [source](https://github.com/mizzao/meteor-user-status/tree/master/demo).

## What's this do?

Tracks users that are online and allows you to use them in useful ways, such as rendering the users online box below showing yourself in orange and other online users in green. Also keeps track of the last time a user logged in, and the time login occurred in the current user session:

![User online states](https://raw.github.com/mizzao/meteor-user-status/master/docs/example.png)

## Install

Install the smart package using **[meteorite](https://github.com/oortcloud/meteorite)**:

```sh
$ mrt add user-status
```

## Basic Usage - Online State

This package maintains two types of status: a general user online flag in `Meteor.users`, and some additional data for each session. It uses [timesync](https://github.com/mizzao/meteor-timesync) to maintain the server's time across all clients, regardless of whether they have the correct time.

`Meteor.users` receives a `status` field will be updated automatically if the user logs in or logs out, closes their browser, or otherwise disconnects (anonymous users are not tracked.) A user is online if at least one connection with that `userId` is logged in. It contains the following fields:

- `online`: whether there is at least one connection online for this user
- `lastLogin`: when this user most recently logged in.

To make this available on the client, use a reactive cursor, such as by creating a publication on the server:

```coffeescript
Meteor.publish "userStatus", ->
  Meteor.users.find { "status.online": true },
    fields: { ... }
```

or you can use this to do things when users go online and offline (however, usually you should just be as reactive as possible):

```coffeescript
Meteor.users.find({ "status.online": true }).observe
  added: (id) ->
    # id just came online
    
  removed: (id) ->
    # id just went offline
```

You can use a reactive cursor to select online users either in a `publish` function or a template helper:

```coffeescript
Template.foo.usersOnline = ->
  Meteor.users.find({ "status.online": true })
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
  else if @status?.online
    "label-success"
  else ""
```

## Advanced Usage and Idle Tracking

On the client, the `UserStatus` object provides for seamless automatic monitoring of a client's idle state. By default, it will listen for all clicks and keypresses in `window` as signals of a user's action. It has the following functions:

- `startMonitor`: a function taking an object with fields `threshold` (the amount of time before a user is counted as idle), `interval` (how often to check if a client has gone idle), and `idleOnBlur` (whether to count a window blur as a user going idle.) This function enables idle tracking on the client.
- `stopMonitor`: stops the running monitor.
- `pingMonitor`: if the automatic event handlers aren't catching what you need, you can manually ping the monitor to signal that a user is doing something.
- `isIdle`: a reactive variable signifying whether the user is currently idle or not.
- `isMonitoring`: a reactive variable for whether the monitor is running.
- `lastActivity`: a reactive variable for the last action recorded by the user (according to [server time](https://github.com/mizzao/meteor-timesync)). Since this variable will be invalidated a lot and cause many recomputations, it's best only used for debugging or diagnostics (as in the demo).

For an example of how the above functions are used, see the demo.

The `UserStatus.sessions` (in-memory) collection contains information for all (logged-in) connections on the server, in the following fields:

- `_id`: the connection id
- `userId`: the user id
- `ipAddr`: the remote address of the client. We don't keep `ipAddr` in `Meteor.users` because a user can be logged in from different places.
- `loginTime`: when the user logged in with this connection.
- `idle`: `true` if idle monitoring is enabled on this connection and the client has gone idle.

The `UserStatus.events` object is an `EventEmitter` on which you can listen for sessions logging in and out. Logging out includes closing the browser; reopening the browser will trigger a new login event. The following events are supported:

- `connectionLogin` with fields `userId`, `connectionId`, and `ipAddr`
- `connectionLogout` with fields `userId` and `connectionId`
- `connectionIdle` with fields `userId`, `connectionId`, and `lastActivity`
- `connectionActive` with fields `userId`, `connectionId`, and `lastActivity`

Check out https://github.com/mizzao/meteor-accounts-testing for a simple accounts drop-in that you can use to test your app - this is also used in the demo.

## Testing

There are some `Tinytest` unit tests that are used to test the logic in this package, but general testing with many users and sessions is hard. Hence, we have set up a demo app (http://user-status.meteor.com) for testing that is also hosted as a proof of concept. If you think you've found a bug in the package, try to replicate it on the demo app and post an issue with steps to reproduce.

## Contributors

* Andrew Mao (https://github.com/mizzao/)
* Rafael Sales (https://github.com/rafaelsales)
* Jonathan James (https://github.com/jonjamz)
* Kirk Stork (https://github.com/kastork)
* Markus Gattol (https://github.com/markusgattol)

If you found this package useful, I gratefully accept donations at [Gittip](https://www.gittip.com/mizzao/).
