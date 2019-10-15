/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
if (Meteor.isServer) {
  export const TEST_username = "status_test";
  export let TEST_userId = undefined;
  export const TEST_IP = "255.255.255.0";

  const testUserExists = Meteor.users.findOne({
    username: TEST_username
  });

  if (!testUserExists) {
    TEST_userId = Meteor.users.insert({
      username: TEST_username
    });
  }
}

// Get a wrapper that runs a before and after function wrapping some test function.
this.getCleanupWrapper = function (settings) {
  const {
    before
  } = settings;
  const {
    after
  } = settings;
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