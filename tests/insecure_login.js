import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import { _ } from 'underscore';

/*
 * Created by https://github.com/matb33 for testing packages that make user of userIds
 * Original file https://github.com/matb33/meteor-collection-hooks/blob/master/tests/insecure_login.js
 */

export const InsecureLogin = {
  queue: [],
  ran: false,
  ready: (callback) => {
    this.queue.push(callback);
    if (this.ran) this.unwind();
  },
  run: () => {
    this.ran = true;
    this.unwind();
  },
  unwind: () => {
    _.each(this.queue, (callback) => {
      callback();
    });
    this.queue = [];
  }
};

if (Meteor.isClient) {
  Accounts.callLoginMethod({
    methodArguments: [{
      username: 'InsecureLogin'
    }],
    userCallback: (err) => {
      if (err) throw err;
      console.info('Insecure login successful!');
      InsecureLogin.run();
    }
  });
} else {
  InsecureLogin.run();
}

if (Meteor.isServer) {
  if (!Meteor.users.find({
      'username': 'InsecureLogin'
    }).count()) {
    Accounts.createUser({
      username: 'InsecureLogin',
      email: 'test@test.com',
      password: 'password',
      profile: {
        name: 'InsecureLogin'
      }
    });
  }

  Accounts.registerLoginHandler((options) => {
    if (!options.username) return;

    var user = Meteor.users.findOne({
      'username': options.username
    });
    if (!user) return;

    return {
      userId: user._id
    };
  });
}
