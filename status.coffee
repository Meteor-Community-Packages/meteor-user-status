###
  Apparently, the new api.export takes care of issues here. No need to attach to global namespace.
  See http://shiggyenterprises.wordpress.com/2013/09/09/meteor-packages-in-coffeescript-0-6-5/

  We may want to make UserSessions a server collection to take advantage of indices.
  Will implement if someone has enough online users to warrant it.
###
UserSessions = new Meteor.Collection("user_status_sessions", { connection: null })

statusEvents = new (Npm.require('events').EventEmitter)()

removeSession = (userId, connectionId) ->
  UserSessions.remove(connectionId)
  statusEvents.emit "connectionLogout",
    userId: userId
    connectionId: connectionId

  if UserSessions.find(userId: userId).count() is 0
    Meteor.users.update userId,
      $set: {'status.online': false }
  return

# Clear any online users on startup (they will re-add themselves)
# Having no status.online is equivalent to status.online = false (above)
# but it is unreasonable to set the entire users collection to false on startup.
Meteor.startup ->
  Meteor.users.update {}
  , $unset: { "status.online": null }
  , {multi: true}

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
Meteor.publish null, ->
  userId = @_session.userId
  return unless @_session.socket?
  connection = @_session.connectionHandle
  connectionId = @_session.id # same as connection.id
  timestamp = Date.now()

  # Untrack connection on logout
  unless userId?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserSessions.findOne(connectionId)
    return unless existing? # Probably new session

    removeSession(existing.userId, connectionId)
    return

  ipAddr = connection.clientAddress

  # Add socket to open connections
  # Hopefully no more duplicate key bug when using upsert!
  UserSessions.upsert connectionId,
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

  Meteor.users.update userId,
    $set: {
      'status.online': true,
      'status.lastLogin': timestamp
    }

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, connectionId)
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return

# TODO the below methods only care about logged in users. We can extend this to all users.
Meteor.methods
  "user-status-idle": (timestamp) ->
    invocation = DDP._CurrentInvocation.get()
    return unless invocation.userId
    connection = invocation.connection

    UserSessions.update connection.id,
      $set: {
        idle: true
        lastActivity: timestamp
      }

    statusEvents.emit "connectionIdle",
      userId: invocation.userId
      connectionId: connection.id
      lastActivity: timestamp

  "user-status-active": (timestamp) ->
    invocation = DDP._CurrentInvocation.get()
    return unless invocation.userId
    connection = invocation.connection

    UserSessions.update connection.id,
      $set: { idle: false }
      $unset: { lastActivity: null }

    statusEvents.emit "connectionActive",
      userId: invocation.userId
      connectionId: connection.id
      lastActivity: timestamp

UserStatus =
  sessions: UserSessions
  events: statusEvents
