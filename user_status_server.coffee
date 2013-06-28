# We may want to make this a server collection to take advantage of indices
this.UserSessions = new Meteor.Collection(null)

removeSession = (userId, sessionId) ->
  UserSessions.remove
    sessionId: sessionId

  if UserSessions.find(userId: userId).count() is 0
    Meteor.users.update userId,
      $set: {'profile.online': false}

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
Meteor.publish "statusWatcher", ->
  userId = @_session.userId
  return unless @_session.socket?
  sessionId = @_session.id

  # Untrack connection on logout
  unless userId?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserSessions.findOne
      sessionId: sessionId
    return unless existing? # Probably new session

    removeSession(existing.userId, sessionId)
    return

  # Add socket to open connections
  UserSessions.insert
    userId: userId
    sessionId: sessionId

  Meteor.users.update userId,
    $set: {'profile.online': true}

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    removeSession(userId, sessionId)
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return
