
# Trick as referenced in http://stackoverflow.com/q/10257958/586086
# TODO: fix possible inconsistency if user has multiple windows open

Meteor.publish "statusWatcher", ->
  id = @_session.userId
  @_session.socket.on "close", Meteor.bindEnvironment( ->
    Meteor.users.update id,
      $set: {'profile.online': false}
  , (e) ->
    Meteor._debug "Exception from connection close callback:", e
  )
