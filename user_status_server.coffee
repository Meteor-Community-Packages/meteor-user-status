this.UserSockets = new Meteor.Collection(null)

# Publication is guaranteed to be called once per connection
# trick as referenced in http://stackoverflow.com/q/10257958/586086
Meteor.publish "statusWatcher", ->
  id = @_session.userId
  return unless id?
  sockId = @_session.socket.id

  # Add socket to open connections
  Meteor.bindEnvironment ->
    UserSockets.insert
      userId: id
      sockId: sockId
  , (e) ->
    Meteor._debug "Exception from connection add callback:", e

  # Remove socket on close
  @_session.socket.on "close", Meteor.bindEnvironment( ->
    UserSockets.remove
      userId: id
      sockId: sockId

    if UserSockets.find(userId: id).count() is 0
      Meteor.users.update id,
        $set: {'profile.online': false}

  , (e) ->
    Meteor._debug "Exception from connection close callback:", e
  )
