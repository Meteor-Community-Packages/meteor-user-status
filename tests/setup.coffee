@TEST_username = "status_test"
@TEST_userId = undefined

unless (@TEST_userId = Meteor.users.findOne(username: TEST_username)?._id)
  @TEST_userId = Meteor.users.insert username: TEST_username

# Get a wrapper that runs a before and after function wrapping some test function.
@getCleanupWrapper = (settings) ->
  before = settings.before
  after = settings.after
  # Take a function...
  return (fn) ->
    # Return a function that, when called, executes the hooks around the function.
    return ->
      before?()
      try
        fn.apply(this, arguments)
      catch error
        throw error
      finally
        after?()
