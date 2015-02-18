###
  Apparently, the new api.export takes care of issues here. No need to attach to global namespace.
  See http://shiggyenterprises.wordpress.com/2013/09/09/meteor-packages-in-coffeescript-0-6-5/

  We may want to make UserSessions a server collection to take advantage of indices.
  Will implement if someone has enough online users to warrant it.
###
UserConnections = new Mongo.Collection("user_status_sessions", { connection: null })

statusEvents = new (Npm.require('events').EventEmitter)()

###
  Multiplex login/logout events to status.online

  'online' field is "true" if user is online, and "false" otherwise

  'idle' field is tri-stated:
  - "true" if user is online and not idle
  - "false" if user is online and idle
  - null if user is offline
###
statusEvents.on "connectionLogin", (advice) ->
  update =
    $set: {
      'status.online': true,
      'status.lastLogin': {
        date: advice.loginTime
        ipAddr: advice.ipAddr
        userAgent: advice.userAgent
      }
    }

  # unless ALL existing connections are idle (including this new one),
  # the user connection becomes active.
  conns = UserConnections.find(userId: advice.userId).fetch()
  unless _.every(conns, (c) -> c.idle)
    update.$set['status.idle'] = false
    update.$unset =
      'status.lastActivity': null
  # in other case, idle field remains true and no update to lastActivity.

  Meteor.users.update advice.userId, update
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
    $set:
      'status.idle': false
    $unset:
      'status.lastActivity': null
  return

# Reset online status on startup (users will reconnect)
onStartup = (selector = {}) ->
  Meteor.users.update selector,
    {
      $set: {
        "status.online": false
      },
      $unset: {
        "status.idle": null
        "status.lastActivity": null
      }
    },
    { multi: true }

###
  Local session modifification functions - also used in testing
###

addSession = (connection) ->
  UserConnections.upsert connection.id,
    $set: {
      ipAddr: connection.clientAddress
      userAgent: connection.httpHeaders['user-agent']
    }
  return

loginSession = (connection, date, userId) ->
  UserConnections.upsert connection.id,
    $set: {
      userId: userId
      loginTime: date
    }

  statusEvents.emit "connectionLogin",
    userId: userId
    connectionId: connection.id
    ipAddr: connection.clientAddress
    userAgent: connection.httpHeaders['user-agent']
    loginTime: date
  return

# Possibly trigger a logout event if this connection was previously associated with a user ID
tryLogoutSession = (connection, date) ->
  return false unless (conn = UserConnections.findOne({
    _id: connection.id
    userId: { $exists: true }
  }))?

  # Yes, this is actually a user logging out.
  UserConnections.upsert connection.id,
    $unset: {
      userId: null
      loginTime: null
    }

  statusEvents.emit "connectionLogout",
    userId: conn.userId
    connectionId: connection.id
    lastActivity: conn.lastActivity # If this connection was idle, pass the last activity we saw
    logoutTime: date

removeSession = (connection, date) ->
  tryLogoutSession(connection, date)
  UserConnections.remove(connection.id)
  return

idleSession = (connection, date, userId) ->
  UserConnections.update connection.id,
    $set: {
      idle: true
      lastActivity: date
    }

  statusEvents.emit "connectionIdle",
    userId: userId
    connectionId: connection.id
    lastActivity: date
  return

activeSession = (connection, date, userId) ->
  UserConnections.update connection.id,
    $set: { idle: false }
    $unset: { lastActivity: null }

  statusEvents.emit "connectionActive",
    userId: userId
    connectionId: connection.id
    lastActivity: date
  return

###
  Handlers for various client-side events
###
Meteor.startup(onStartup)

# Opening and closing of DDP connections
Meteor.onConnection (connection) ->
  addSession(connection)

  connection.onClose ->
    removeSession(connection, new Date())

# Authentication of a DDP connection
Accounts.onLogin (info) ->
  loginSession(info.connection, new Date(), info.user._id)

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
# We used this in the past, but still need this to detect logouts on the same connection.
Meteor.publish null, ->
  # Return null explicitly if this._session is not available, i.e.:
  # https://github.com/arunoda/meteor-fast-render/issues/41
  return [] unless @_session?

  # We're interested in logout events - re-publishes for which a past connection exists
  tryLogoutSession(@_session.connectionHandle, new Date()) unless @userId?

  return []

# We can use the client's timestamp here because it was sent from a TimeSync
# value, however we should never trust it for something security dependent.
# If timestamp is not provided (probably due to a desync), use server time.
Meteor.methods
  "user-status-idle": (timestamp) ->
    check(timestamp, Match.OneOf(null, undefined, Date, Number) )

    date = if timestamp? then new Date(timestamp) else new Date()
    idleSession(@connection, date, @userId)
    return

  "user-status-active": (timestamp) ->
    check(timestamp, Match.OneOf(null, undefined, Date, Number) )

    # We only use timestamp because it's when we saw activity *on the client*
    # as opposed to just being notified it. It is probably more accurate even if
    # a dozen ms off due to the latency of sending it to the server.
    date = if timestamp? then new Date(timestamp) else new Date()
    activeSession(@connection, date, @userId)
    return

# Exported variable
UserStatus =
  connections: UserConnections
  events: statusEvents

# Internal functions, exported for testing
StatusInternals = {
  onStartup,
  addSession,
  removeSession,
  loginSession,
  tryLogoutSession,
  idleSession,
  activeSession,
}
