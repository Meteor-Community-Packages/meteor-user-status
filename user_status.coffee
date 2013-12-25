###
  Apparently, the new api.export takes care of issues here. No need to attach to global namespace.
  See http://shiggyenterprises.wordpress.com/2013/09/09/meteor-packages-in-coffeescript-0-6-5/

  We may want to make UserSessions a server collection to take advantage of indices.
###
UserSessions = new Meteor.Collection(null)

UserStatus = new (Npm.require('events').EventEmitter)()

removeSession = (userId, sessionId) ->
  UserSessions.remove(sessionId)
  UserStatus.emit("sessionLogout", userId, sessionId)

  if UserSessions.find(userId: userId).count() is 0
    Meteor.users.update userId,
      $set: {'profile.online': false}
  return

# Clear any online users on startup (they will re-add themselves)
Meteor.startup ->
  Meteor.users.update {},
    $unset: { "profile.online": null }
  , {multi: true}

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
Meteor.publish null, ->
  userId = @_session.userId
  return unless @_session.socket?
  sessionId = @_session.id
  dateMs = new Date().getTime()
  
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
    $set:
      userId: userId
      ipAddr: ipAddr
      loginTime: dateMs

  UserStatus.emit("sessionLogin", userId, sessionId, ipAddr, dateMs)

  Meteor.users.update userId,
    $set: {'profile.online': true, 'profile.lastLogin': dateMs}

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, sessionId)
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return
