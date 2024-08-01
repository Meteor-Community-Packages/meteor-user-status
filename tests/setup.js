/* eslint-disable no-useless-catch */
import { Meteor } from 'meteor/meteor';

export const TEST_username = 'status_test';
export let TEST_userId = '';
export const TEST_IP = '255.255.255.0';

if (Meteor.isServer) {
  const testUserExists = await Meteor.users.findOneAsync({
    username: TEST_username
  });

  if (!testUserExists) {
    TEST_userId = await Meteor.users.insertAsync({
      username: TEST_username
    });
    console.log('Inserted test user id: ', TEST_userId);
  } else {
    TEST_userId = testUserExists._id;
  }
}

// Get a wrapper that runs a before and after function wrapping some test function.
export const getCleanupWrapper = function (settings) {
  const { before } = settings;
  const { after } = settings;
  // Take a function...
  return fn => // Return a function that, when called, executes the hooks around the function.
    (function () {
      const next = arguments[1];
      if (typeof before === 'function') {
        before();
      }

      if (next == null) {
        // Synchronous version - Tinytest.add
        try {
          return fn.apply(this, arguments);
        } catch (error) {
          throw error;
        } finally {
          if (typeof after === 'function') {
            after();
          }
        }
      } else {
        // Asynchronous version - Tinytest.addAsync
        const hookedNext = function () {
          if (typeof after === 'function') {
            after();
          }
          return next();
        };
        return fn.call(this, arguments[0], hookedNext);
      }
    });
};
