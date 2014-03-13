###
  Apparently, the new api.export takes care of issues here. No need to attach to global namespace.
  See http://shiggyenterprises.wordpress.com/2013/09/09/meteor-packages-in-coffeescript-0-6-5/

  We may want to make UserSessions a server collection to take advantage of indices.
  Will implement if someone has enough online users to warrant it.
###
UserSessions = new Meteor.Collection(null)

statusEvents = new (Npm.require('events').EventEmitter)()

removeSession = (userId, sessionId) ->
  UserSessions.remove(sessionId)
  statusEvents.emit "sessionLogout",
    userId: userId
    sessionId: sessionId

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
  sessionId = @_session.id
  timestamp = +new Date
  
  # Untrack connection on logout
  unless userId?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserSessions.findOne(sessionId)
    return unless existing? # Probably new session

    removeSession(existing.userId, sessionId)
    return

  # Add socket to open connections
  ipAddr = @_session.socket.headers?['x-forwarded-for'] || @_session.socket.remoteAddress

  # Hopefully no more duplicate key bug when using upsert!
  UserSessions.upsert sessionId,
    $set: {
      userId: userId
      ipAddr: ipAddr
      loginTime: timestamp
    }

  statusEvents.emit "sessionLogin",
    userId: userId
    sessionId: sessionId
    ipAddr: ipAddr
    loginTime: timestamp

  Meteor.users.update userId,
    $set: {
      'status.online': true,
      'status.lastLogin': timestamp
    }

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, sessionId)
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return

UserStatus =
  sessions: UserSessions
  events: statusEvents
