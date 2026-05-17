import { Meteor } from 'meteor/meteor';

export const TEST_username = 'status_test';
export const TEST_userId = 'status_test_user';
export const TEST_IP = '255.255.255.0';

export const ensureTestUser = async () => {
  if (!Meteor.isServer) {
    return;
  }

  const testUserExists = await Meteor.users.findOneAsync(TEST_userId);

  if (!testUserExists) {
    await Meteor.users.insertAsync({
      _id: TEST_userId,
      username: TEST_username
    });
    console.log('Inserted test user id: ', TEST_userId);
  }
};

// Get a wrapper that runs a before and after function wrapping some test function.
export const getCleanupWrapper = function (settings) {
  const { before } = settings;
  const { after } = settings;
  // Take a function...
  return fn => // Return a function that, when called, executes the hooks around the function.
    (function () {
      const next = arguments[1];
      const test = arguments[0];
      const runBefore = () => (typeof before === 'function') ? before() : undefined;
      const runAfter = () => (typeof after === 'function') ? after() : undefined;
      const fail = (error) => {
        if (typeof (test != null ? test.fail : undefined) === 'function') {
          test.fail(error != null && error.stack ? error.stack : error);
        } else {
          throw error;
        }
      };

      const finish = () => Promise.resolve(runAfter()).then(() => next());

      if (typeof next === 'function') {
        // Asynchronous version - Tinytest.addAsync
        const handleError = error => Promise.resolve(runAfter()).then(() => {
          fail(error);
          next();
        });
        const run = () => {
          try {
            const result = fn.call(this, test, finish);
            if (result != null && typeof result.then === 'function') {
              result.then(finish).catch(handleError);
            }
          } catch (error) {
            handleError(error);
          }
        };

        try {
          const beforeResult = runBefore();
          if (beforeResult != null && typeof beforeResult.then === 'function') {
            beforeResult.then(run).catch(handleError);
          } else {
            run();
          }
        } catch (error) {
          handleError(error);
        }

        return;
      }

      // Synchronous version - Tinytest.add
      runBefore();
      try {
        return fn.apply(this, arguments);
      } finally {
        runAfter();
      }
    });
};
