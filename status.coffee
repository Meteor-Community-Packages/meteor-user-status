###
  Apparently, the new api.export takes care of issues here. No need to attach to global namespace.
  See http://shiggyenterprises.wordpress.com/2013/09/09/meteor-packages-in-coffeescript-0-6-5/

  We may want to make UserSessions a server collection to take advantage of indices.
  Will implement if someone has enough online users to warrant it.
###
UserConnections = new Meteor.Collection("user_status_sessions", { connection: null })

statusEvents = new (Npm.require('events').EventEmitter)()

###
  Multiplex login/logout events to status.online
###
statusEvents.on "connectionLogin", (advice) ->
  Meteor.users.update advice.userId,
    $set:
      'status.online': true,
      'status.lastLogin': advice.loginTime
  return

statusEvents.on "connectionLogout", (advice) ->
  conns = UserConnections.find(userId: advice.userId).fetch()
  if conns.length is 0
    # Go offline if we are the last connection for this user
    # This includes removing all idle information
    Meteor.users.update advice.userId,
      $set: {'status.online': false }
      $unset:
        'status.idle': null
        'status.lastActivity': null
  else if _.every(conns, (c) -> c.idle)
    # If the last active connection quit, then we should go idle with the most recent activity
    Meteor.users.update advice.userId,
      $set:
        'status.idle': true
        'status.lastActivity': _.max(_.pluck conns, "lastActivity")
  return

###
  Multiplex idle/active events to status.idle
  TODO: Hopefully this is quick because it's all in memory, but we can use indices if it turns out to be slow

  TODO: There is a race condition when switching between tabs, leaving the user inactive while idle goes from one tab to the other.
  It can probably be smoothed out.
###
statusEvents.on "connectionIdle", (advice) ->
  conns = UserConnections.find(userId: advice.userId).fetch()
  return unless _.every(conns, (c) -> c.idle)
  # Set user to idle if all the connections are idle
  # This idle be the most recent one in the vast majority of cases

  # XXX the race happens here where everyone was idle when we looked for them but now one of them isn't.
  Meteor.users.update advice.userId,
    $set:
      'status.idle': true
      'status.lastActivity': advice.lastActivity
  return

statusEvents.on "connectionActive", (advice) ->
  Meteor.users.update advice.userId,
    $unset:
      'status.idle': null
      'status.lastActivity': null
  return

# Clear any online users on startup (they will re-add themselves)
# Having no status.online is equivalent to status.online = false (above)
# but it is unreasonable to set the entire users collection to false on startup.
Meteor.startup ->
  Meteor.users.update {}
  , $unset: {
    "status.online": null
    "status.idle": null
    "status.lastActivity": null
  }
  , {multi: true}

removeSession = (userId, connectionId) ->
  UserConnections.remove(connectionId)
  statusEvents.emit "connectionLogout",
    userId: userId
    connectionId: connectionId
  return

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
# TODO: replace this with Meteor.onConnection?

Meteor.publish null, ->
  userId = @_session.userId
  return unless @_session.socket?
  connection = @_session.connectionHandle
  connectionId = @_session.id # same as connection.id
  timestamp = Date.now()

  # Untrack connection on logout
  unless userId?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserConnections.findOne(connectionId)
    return unless existing? # Probably new session

    removeSession(existing.userId, connectionId)
    return

  ipAddr = connection.clientAddress

  # Add socket to open connections
  # Hopefully no more duplicate key bug when using upsert!
  UserConnections.upsert connectionId,
    $set: {
      userId: userId
      ipAddr: ipAddr
      loginTime: timestamp
    }

  statusEvents.emit "connectionLogin",
    userId: userId
    connectionId: connectionId
    ipAddr: ipAddr
    loginTime: timestamp

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, connectionId)
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return

# TODO the below methods only care about logged in users.
# We can extend this to all users. (See also client code)
# We can trust the timestamp here because it was sent from a TimeSync value.

Meteor.methods
  "user-status-idle": (timestamp) ->
    return unless @userId

    UserConnections.update @connection.id,
      $set: {
        idle: true
        lastActivity: timestamp
      }

    statusEvents.emit "connectionIdle",
      userId: @userId
      connectionId: @connection.id
      lastActivity: timestamp

  "user-status-active": (timestamp) ->
    return unless @userId

    UserConnections.update @connection.id,
      $set: { idle: false }
      $unset: { lastActivity: null }

    statusEvents.emit "connectionActive",
      userId: @userId
      connectionId: @connection.id
      lastActivity: timestamp

UserStatus =
  connections: UserConnections
  events: statusEvents
