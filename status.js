/*
  Apparently, the new api.export takes care of issues here. No need to attach to global namespace.
  See http://shiggyenterprises.wordpress.com/2013/09/09/meteor-packages-in-coffeescript-0-6-5/

  We may want to make UserSessions a server collection to take advantage of indices.
  Will implement if someone has enough online users to warrant it.
*/
const UserConnections = new Mongo.Collection("user_status_sessions", {
  connection: null
});

const statusEvents = new(Npm.require('events').EventEmitter)();

/*
  Multiplex login/logout events to status.online

  'online' field is "true" if user is online, and "false" otherwise

  'idle' field is tri-stated:
  - "true" if user is online and not idle
  - "false" if user is online and idle
  - null if user is offline
*/
statusEvents.on("connectionLogin", function (advice) {
  const update = {
    $set: {
      'status.online': true,
      'status.lastLogin': {
        date: advice.loginTime,
        ipAddr: advice.ipAddr,
        userAgent: advice.userAgent
      }
    }
  };

  // unless ALL existing connections are idle (including this new one),
  // the user connection becomes active.
  const conns = UserConnections.find({
    userId: advice.userId
  }).fetch();
  if (!_.every(conns, c => c.idle)) {
    update.$set['status.idle'] = false;
    update.$unset = {
      'status.lastActivity': null
    };
  }
  // in other case, idle field remains true and no update to lastActivity.

  Meteor.users.update(advice.userId, update);
});

statusEvents.on("connectionLogout", function (advice) {
  const conns = UserConnections.find({
    userId: advice.userId
  }).fetch();
  if (conns.length === 0) {
    // Go offline if we are the last connection for this user
    // This includes removing all idle information
    Meteor.users.update(advice.userId, {
      $set: {
        'status.online': false
      },
      $unset: {
        'status.idle': null,
        'status.lastActivity': null
      }
    });
  } else if (_.every(conns, c => c.idle)) {
    /*
      All remaining connections are idle:
      - If the last active connection quit, then we should go idle with the most recent activity

      - If an idle connection quit, nothing should happen; specifically, if the
        most recently active idle connection quit, we shouldn't tick the value backwards.
        This may result in a no-op so we can be smart and skip the update.
    */
    if (advice.lastActivity != null) {
      return;
    } // The dropped connection was already idle

    Meteor.users.update(advice.userId, {
      $set: {
        'status.idle': true,
        'status.lastActivity': _.max(_.pluck(conns, "lastActivity"))
      }
    });
  }
});

/*
  Multiplex idle/active events to status.idle
  TODO: Hopefully this is quick because it's all in memory, but we can use indices if it turns out to be slow

  TODO: There is a race condition when switching between tabs, leaving the user inactive while idle goes from one tab to the other.
  It can probably be smoothed out.
*/
statusEvents.on("connectionIdle", function (advice) {
  const conns = UserConnections.find({
    userId: advice.userId
  }).fetch();
  if (!_.every(conns, c => c.idle)) {
    return;
  }
  // Set user to idle if all the connections are idle
  // This will not be the most recent idle across a disconnection, so we use max

  // TODO: the race happens here where everyone was idle when we looked for them but now one of them isn't.
  Meteor.users.update(advice.userId, {
    $set: {
      'status.idle': true,
      'status.lastActivity': _.max(_.pluck(conns, "lastActivity"))
    }
  });
});

statusEvents.on("connectionActive", function (advice) {
  Meteor.users.update(advice.userId, {
    $set: {
      'status.idle': false
    },
    $unset: {
      'status.lastActivity': null
    }
  });
});

// Reset online status on startup (users will reconnect)
const onStartup = function (selector) {
  if (selector == null) {
    selector = {};
  }
  return Meteor.users.update(selector, {
    $set: {
      "status.online": false
    },
    $unset: {
      "status.idle": null,
      "status.lastActivity": null
    }
  }, {
    multi: true
  });
};

/*
  Local session modifification functions - also used in testing
*/

const addSession = function (connection) {
  UserConnections.upsert(connection.id, {
    $set: {
      ipAddr: connection.clientAddress,
      userAgent: connection.httpHeaders['user-agent']
    }
  });
};

const loginSession = function (connection, date, userId) {
  UserConnections.upsert(connection.id, {
    $set: {
      userId,
      loginTime: date
    }
  });

  statusEvents.emit("connectionLogin", {
    userId,
    connectionId: connection.id,
    ipAddr: connection.clientAddress,
    userAgent: connection.httpHeaders['user-agent'],
    loginTime: date
  });
};

// Possibly trigger a logout event if this connection was previously associated with a user ID
const tryLogoutSession = function (connection, date) {
  let conn;
  if ((conn = UserConnections.findOne({
      _id: connection.id,
      userId: {
        $exists: true
      }
    })) == null) {
    return false;
  }

  // Yes, this is actually a user logging out.
  UserConnections.upsert(connection.id, {
    $unset: {
      userId: null,
      loginTime: null
    }
  });

  return statusEvents.emit("connectionLogout", {
    userId: conn.userId,
    connectionId: connection.id,
    lastActivity: conn.lastActivity, // If this connection was idle, pass the last activity we saw
    logoutTime: date
  });
};

const removeSession = function (connection, date) {
  tryLogoutSession(connection, date);
  UserConnections.remove(connection.id);
};

const idleSession = function (connection, date, userId) {
  UserConnections.update(connection.id, {
    $set: {
      idle: true,
      lastActivity: date
    }
  });

  statusEvents.emit("connectionIdle", {
    userId,
    connectionId: connection.id,
    lastActivity: date
  });
};

const activeSession = function (connection, date, userId) {
  UserConnections.update(connection.id, {
    $set: {
      idle: false
    },
    $unset: {
      lastActivity: null
    }
  });

  statusEvents.emit("connectionActive", {
    userId,
    connectionId: connection.id,
    lastActivity: date
  });
};

/*
  Handlers for various client-side events
*/
Meteor.startup(onStartup);

// Opening and closing of DDP connections
Meteor.onConnection(function (connection) {
  addSession(connection);

  return connection.onClose(() => removeSession(connection, new Date()));
});

// Authentication of a DDP connection
Accounts.onLogin(info => loginSession(info.connection, new Date(), info.user._id));

// pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
// We used this in the past, but still need this to detect logouts on the same connection.
Meteor.publish(null, function () {
  // Return null explicitly if this._session is not available, i.e.:
  // https://github.com/arunoda/meteor-fast-render/issues/41
  if (this._session == null) {
    return [];
  }

  // We're interested in logout events - re-publishes for which a past connection exists
  if (this.userId == null) {
    tryLogoutSession(this._session.connectionHandle, new Date());
  }

  return [];
});

// We can use the client's timestamp here because it was sent from a TimeSync
// value, however we should never trust it for something security dependent.
// If timestamp is not provided (probably due to a desync), use server time.
Meteor.methods({
  "user-status-idle"(timestamp) {
    check(timestamp, Match.OneOf(null, undefined, Date, Number));

    const date = (timestamp != null) ? new Date(timestamp) : new Date();
    idleSession(this.connection, date, this.userId);
  },

  "user-status-active"(timestamp) {
    check(timestamp, Match.OneOf(null, undefined, Date, Number));

    // We only use timestamp because it's when we saw activity *on the client*
    // as opposed to just being notified it. It is probably more accurate even if
    // a dozen ms off due to the latency of sending it to the server.
    const date = (timestamp != null) ? new Date(timestamp) : new Date();
    activeSession(this.connection, date, this.userId);
  }
});

// Exported variable
const UserStatus = {
  connections: UserConnections,
  events: statusEvents
};

// Internal functions, exported for testing
const StatusInternals = {
  onStartup,
  addSession,
  removeSession,
  loginSession,
  tryLogoutSession,
  idleSession,
  activeSession,
};