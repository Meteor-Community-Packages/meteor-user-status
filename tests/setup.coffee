if Meteor.isServer
  @TEST_username = "status_test"
  @TEST_userId = undefined
  @TEST_IP = "255.255.255.0"

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
      next = arguments[1]
      before?()

      unless next?
        # Synchronous version - Tinytest.add
        try
          fn.apply(this, arguments)
        catch error
          throw error
        finally
          after?()
      else
        # Asynchronous version - Tinytest.addAsync
        hookedNext = ->
          after?()
          next()
        fn.call this, arguments[0], hookedNext
