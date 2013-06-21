
# Hook into original logout function
Meteor.__logout__ = Meteor.logout
Meteor.logout = (callback) ->
  Meteor.users.update Meteor.userId(),
    $set: {'profile.online': false}
  Meteor.__logout__(callback)

# Add online status when logged in or resuming
Deps.autorun ->
  return unless Meteor.userId()
  Meteor.users.update Meteor.userId(),
    $set: {'profile.online': true}

Meteor.subscribe "statusWatcher"
