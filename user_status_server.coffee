this.UserSockets = new Meteor.Collection(null)

# pub/sub trick as referenced in http://stackoverflow.com/q/10257958/586086
Meteor.publish "statusWatcher", ->
  id = @_session.userId
  return unless @_session.socket?
  sockId = @_session.socket.id

  # Untrack connection on logout
  unless id?
    # TODO: this could be replaced with a findAndModify once it's supported on Collections
    existing = UserSockets.findOne
      sockId: sockId
    return unless existing? # Probably new session

    id = existing.userId
    UserSockets.remove
      sockId: sockId

    if UserSockets.find(userId: id).count() is 0
      Meteor.users.update id,
        $set: {'profile.online': false}
    return

  # Add socket to open connections
  UserSockets.insert
    userId: id
    sockId: sockId
  Meteor.users.update id,
    $set: {'profile.online': true}

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment ->
    UserSockets.remove
      userId: id
      sockId: sockId

    if UserSockets.find(userId: id).count() is 0
      Meteor.users.update id,
        $set: {'profile.online': false}
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e

  return
