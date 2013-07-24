# We may want to make this a server collection to take advantage of indices
this.UserSessions = new Meteor.Collection(null)

this.UserStatus = new (Npm.require('events').EventEmitter)()

removeSession = (userId, sessionId) ->
  UserSessions.remove
    _id: sessionId
  UserStatus.emit("sessionLogout", userId, sessionId)

  if UserSessions.find(userId: userId).count() is 0
    Meteor.users.update userId,
      $set: {'profile.online': false}

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

  # Untrack connection on logout
  unless userId?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserSessions.findOne
      _id: sessionId
    return unless existing? # Probably new session

    removeSession(existing.userId, sessionId)
    return

  # Add socket to open connections
  ipAddr = @_session.socket.headers?['x-forwarded-for'] || @_session.socket.remoteAddress
  UserSessions.insert
    _id: sessionId
    userId: userId
    ipAddr: ipAddr
  UserStatus.emit("sessionLogin", userId, sessionId, ipAddr)

  Meteor.users.update userId,
    $set: {'profile.online': true}

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, sessionId)
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return
