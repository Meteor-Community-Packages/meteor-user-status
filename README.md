user-status
===========

[![Build Status](https://travis-ci.org/Meteor-Community-Packages/meteor-user-status.png?branch=master)](https://travis-ci.org/Meteor-Community-Packages/meteor-user-status)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/Meteor-Community-Packages/meteor-user-status.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Meteor-Community-Packages/meteor-user-status/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/Meteor-Community-Packages/meteor-user-status.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Meteor-Community-Packages/meteor-user-status/context:javascript)
[![Project Dependencies](https://david-dm.org/Meteor-Community-Packages/meteor-user-status.svg)](https://david-dm.org/Meteor-Community-Packages/meteor-user-status)
[![devDependencies Status](https://david-dm.org/Meteor-Community-Packages/meteor-user-status/dev-status.svg)](https://david-dm.org/Meteor-Community-Packages/meteor-user-status?type=dev)


## What's this do?

Keeps track of user connection data, such as IP addresses, user agents, and
client-side activity, and tracks this information in `Meteor.users` as well as
some other objects. This allows you to easily see users that are online, for
applications such as rendering the users box below showing online users in green
and idle users in orange.

![User online states](https://raw.github.com/Meteor-Community-Packages/meteor-user-status/master/docs/example.png)

For a complete example of what can be tracked, including inactivity, IP
addresses, and user agents, check out a demo app at
http://user-status.meteor.com, or its
[source](https://github.com/Meteor-Community-Packages/meteor-user-status/tree/master/demo).

## Install

Install using Meteor:

```sh
$ meteor add mizzao:user-status
```

Additionally, note that to read client IP addresses properly, you must set the
`HTTP_FORWARDED_COUNT` environment variable for your app, and make sure that IP
address headers are forwarded for any reverse proxy installed in front of the
app. See the [Meteor docs on this](http://docs.meteor.com/#meteor_onconnection)
for more details.

## Basic Usage - Online State

This package maintains two types of status: a general user online flag in `Meteor.users`, and some additional data for each session. It uses [timesync](https://github.com/Meteor-Community-Packages/meteor-timesync) to maintain the server's time across all clients, regardless of whether they have the correct time.

`Meteor.users` receives a `status` field will be updated automatically if the user logs in or logs out, closes their browser, or otherwise disconnects. A user is online if at least one connection with that `userId` is logged in. It contains the following fields:

- `online`: `true` if there is at least one connection online for this user
- `lastLogin`: information about the most recent login of the user, with the fields `date`, `ipAddr`, and `userAgent`.
- `idle`: `true` if all connections for this user are idle. Requires idle tracking to be turned on for all connections, as below.
- `lastActivity`: if the user was idle, the last time an action was observed. This field is only available when the user is online and idle. It does not maintain the user's last activity in real time or a stored value indefinitely - `lastLogin` is a coarse approximation to that. For more information, see https://github.com/Meteor-Community-Packages/meteor-user-status/issues/80.

To make this available on the client, use a reactive cursor, such as by creating a publication on the server:

```javascript
Meteor.publish("userStatus", function() {
  return Meteor.users.find({ "status.online": true }, { fields: { ... } });
});
```

or you can use this to do certain actions when users go online and offline.

```javascript
Meteor.users.find({ "status.online": true }).observe({
  added: function(id) {
    // id just came online
  },
  removed: function(id) {
    // id just went offline
  }
});
```

You can use a reactive cursor to select online users in a client-side template helper:

```javascript
Template.foo.usersOnline = function() {
  return Meteor.users.find({ "status.online": true })
};
```

Making this directly available on the client allows for useful template renderings of user state. For example, with something like the following you get the picture above (using bootstrap classes).

```
<template name="userPill">
    <span class="label {{labelClass}}">{{username}}</span>
</template>
```

```javascript
Template.userPill.labelClass = function() {
  if (this.status.idle)
    return "label-warning"
  else if (this.status.online)
    return "label-success"
  else
    return "label-default"
};
```

## Advanced Usage and Idle Tracking

### Client API

On the client, the `UserStatus` object provides for seamless automatic monitoring of a client's idle state. By default, it will listen for all clicks and keypresses in `window` as signals of a user's action. It has the following functions:

- `startMonitor`: a function taking an object with fields `threshold` (the amount of time before a user is counted as idle), `interval` (how often to check if a client has gone idle), and `idleOnBlur` (whether to count a window blur as a user going idle.) This function enables idle tracking on the client.
- `stopMonitor`: stops the running monitor.
- `pingMonitor`: if the automatic event handlers aren't catching what you need, you can manually ping the monitor to signal that a user is doing something and reset the idle monitor.
- `isIdle`: a reactive variable signifying whether the user is currently idle or not.
- `isMonitoring`: a reactive variable for whether the monitor is running.
- `lastActivity`: a reactive variable for the last action recorded by the user (according to [server time](https://github.com/Meteor-Community-Packages/meteor-timesync)). Since this variable will be invalidated a lot and cause many recomputations, it's best only used for debugging or diagnostics (as in the demo).

For an example of how the above functions are used, see the demo.

### Server API

The `UserStatus.connections` (in-memory) collection contains information for all connections on the server, in the following fields:

- `_id`: the connection id.
- `userId`: the user id, if the connection is authenticated.
- `ipAddr`: the remote address of the connection. A user logged in from different places will have one document per connection.
- `userAgent`: the user agent of the connection.
- `loginTime`: if authenticated, when the user logged in with this connection.
- `idle`: `true` if idle monitoring is enabled on this connection and the client has gone idle.

#### Usage with collection2

If your project is using `aldeed:collection2` with a schema attached to `Meteor.users`, you need to add the following items to the schema to allow modifications of the status:

```javascript
import SimpleSchema from 'simpl-schema';

const userSchema = new SimpleSchema({
    status: {
        type: Object,
        optional: true,
    },
    'status.lastlogin': {
        type: Object,
        optional: true,
    },
    'status.lastlogin.date': {
        type: Date,
        optional: true,
    },
    'status.lastlogin.ipAddr': {
        type: String,
        optional: true,
    },
    'status.userAgent': {
        type: String,
        optional: true,
    },
    'status.idle': {
        type: Boolean,
        optional: true,
    },
    'status.lastActivity': {
        type: Date,
        optional: true,
    },
    'status.online': {
        type: Boolean,
        optional: true,
    },
});

// attaching the Schema to Meteor.users will extend it
Meteor.users.attachSchema(userSchema);

```

#### Events

The `UserStatus.events` object is an `EventEmitter` on which you can listen for connections logging in and out. Logging out includes closing the browser; reopening the browser will trigger a new login event. The following events are supported:

#### `UserStatus.events.on("connectionLogin", function(fields) { ... })`

`fields` contains `userId`, `connectionId`, `ipAddr`, `userAgent`, and `loginTime`.

#### `UserStatus.events.on("connectionLogout", function(fields) { ... })`

`fields` contains `userId`, `connectionId`, `lastActivity`, and `logoutTime`.

#### `UserStatus.events.on("connectionIdle", function(fields) { ... })`

`fields` contains `userId`, `connectionId`, and `lastActivity`.

#### `UserStatus.events.on("connectionActive", function(fields) { ... })`

`fields` contains `userId`, `connectionId`, and `lastActivity`.

Check out https://github.com/mizzao/meteor-accounts-testing for a simple accounts drop-in that you can use to test your app - this is also used in the demo.

## Testing

There are some `Tinytest` unit tests that are used to test the logic in this package, but general testing with many users and connections is hard. Hence, we have set up a demo app (http://user-status.meteor.com) for testing that is also hosted as a proof of concept. If you think you've found a bug in the package, try to replicate it on the demo app and post an issue with steps to reproduce.

## Contributing

See [Contributing.md](Contributing.md).