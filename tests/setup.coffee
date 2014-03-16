@TEST_username = "status_test"
@TEST_userId = undefined

unless (@TEST_userId = Meteor.users.findOne(username: TEST_username)?._id)
  @TEST_userId = Meteor.users.insert username: TEST_username


