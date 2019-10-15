/*
 * Created by https://github.com/matb33 for testing packages that make user of userIds
 * Original file https://github.com/matb33/meteor-collection-hooks/blob/master/tests/insecure_login.js
 */

InsecureLogin = {
  queue: [],
  ran: false,
  ready: function (callback) {
    this.queue.push(callback);
    if (this.ran) this.unwind();
  },
  run: function () {
    this.ran = true;
    this.unwind();
  },
  unwind: function () {
    _.each(this.queue, function (callback) {
      callback();
    });
    this.queue = [];
  }
};

if (Meteor.isClient) {
  Accounts.callLoginMethod({
    methodArguments: [{
      username: "InsecureLogin"
    }],
    userCallback: function (err) {
      if (err) throw err;
      console.info("Insecure login successful!");
      InsecureLogin.run();
    }
  });
} else {
  InsecureLogin.run();
}

if (Meteor.isServer) {
  if (!Meteor.users.find({
      "username": "InsecureLogin"
    }).count()) {
    Accounts.createUser({
      username: "InsecureLogin",
      email: "test@test.com",
      password: "password",
      profile: {
        name: "InsecureLogin"
      }
    });
  }

  Accounts.registerLoginHandler(function (options) {
    if (!options.username) return;

    var user = Meteor.users.findOne({
      "username": options.username
    });
    if (!user) return;

    return {
      userId: user._id
    };
  });
}