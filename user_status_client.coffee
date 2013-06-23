Deps.autorun ->
  Meteor.userId() # Re-subscribe whenever logging in our out
  Meteor.subscribe "statusWatcher"
