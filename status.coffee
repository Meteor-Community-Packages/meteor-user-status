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
    ###
      All remaining connections are idle:
      - If the last active connection quit, then we should go idle with the most recent activity

      - If an idle connection quit, nothing should happen; specifically, if the
        most recently active idle connection quit, we shouldn't tick the value backwards.
        This may result in a no-op so we can be smart and skip the update.
    ###
    return if advice.lastActivity? # The dropped connection was already idle

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
  # This will not be the most recent idle across a disconnection, so we use max

  # TODO: the race happens here where everyone was idle when we looked for them but now one of them isn't.
  Meteor.users.update advice.userId,
    $set:
      'status.idle': true
      'status.lastActivity': _.max(_.pluck conns, "lastActivity")
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

###
  Local session modifification functions - also used in testing
###

addSession = (userId, connectionId, date, ipAddr) ->
  UserConnections.upsert connectionId,
    $set: {
      userId: userId
      ipAddr: ipAddr
      loginTime: date
    }

  statusEvents.emit "connectionLogin",
    userId: userId
    connectionId: connectionId
    ipAddr: ipAddr
    loginTime: date
  return

removeSession = (userId, connectionId, date) ->
  conn = UserConnections.findOne(connectionId)
  # Don't emit this again if the connection was already closed
  return unless conn?

  UserConnections.remove(connectionId)

  statusEvents.emit "connectionLogout",
    userId: userId
    connectionId: connectionId
    lastActivity: conn?.lastActivity # If this connection was idle, pass the last activity we saw
    logoutTime: date
  return

idleSession = (userId, connectionId, date) ->
  UserConnections.update connectionId,
    $set: {
      idle: true
      lastActivity: date
    }

  statusEvents.emit "connectionIdle",
    userId: userId
    connectionId: connectionId
    lastActivity: date
  return

activeSession = (userId, connectionId, date) ->
  UserConnections.update connectionId,
    $set: { idle: false }
    $unset: { lastActivity: null }

  statusEvents.emit "connectionActive",
    userId: userId
    connectionId: connectionId
    lastActivity: date
  return

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
# TODO: replace this with Meteor.onConnection and login hooks.

Meteor.publish null, ->
  # Return null explicitly if this._session is not available, i.e.:
  # https://github.com/arunoda/meteor-fast-render/issues/41
  return null unless @_session

  date = new Date() # compute this as early as possible
  userId = @_session.userId
  return null unless @_session.socket? # Or there is nothing to close!

  connection = @_session.connectionHandle
  connectionId = @_session.id # same as connection.id

  # Untrack connection on logout
  unless userId?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserConnections.findOne(connectionId)
    return null unless existing? # Probably new session

    removeSession(existing.userId, connectionId, date)
    return null

  # Add socket to open connections
  addSession(userId, connectionId, date, connection.clientAddress)

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, connectionId, new Date())
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e
  return null

# TODO the below methods only care about logged in users.
# We can extend this to all users. (See also client code)
# We can trust the timestamp here because it was sent from a TimeSync value.
Meteor.methods
  "user-status-idle": (timestamp) ->
    return unless @userId
    idleSession(@userId, @connection.id, new Date(timestamp))
    return

  "user-status-active": (timestamp) ->
    return unless @userId
    # We only use timestamp because it's when we saw activity *on the client*
    # as opposed to just being notified it.
    # It is probably more accurate even if a few hundred ms off
    # due to how long the message took to get here.
    activeSession(@userId, @connection.id, new Date(timestamp))
    return

# Exported variable
UserStatus =
  connections: UserConnections
  events: statusEvents

# Internal functions, exported for testing
StatusInternals =
  addSession: addSession
  removeSession: removeSession
  idleSession: idleSession
  activeSession: activeSession
