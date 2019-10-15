let lastLoginAdvice = null;
let lastLogoutAdvice = null;
let lastIdleAdvice = null;
let lastActiveAdvice = null;

// Record events for tests
UserStatus.events.on("connectionLogin", advice => lastLoginAdvice = advice);
UserStatus.events.on("connectionLogout", advice => lastLogoutAdvice = advice);
UserStatus.events.on("connectionIdle", advice => lastIdleAdvice = advice);
UserStatus.events.on("connectionActive", advice => lastActiveAdvice = advice);

const TEST_UA = "old-ass browser";

// Make sure repeated calls to this return different values
const delayedDate = () => Meteor.wrapAsync(cb => Meteor.setTimeout((() => cb(undefined, new Date())), 1))();

const randomConnection = () => ({
  id: Random.id(),
  clientAddress: TEST_IP,

  httpHeaders: {
    "user-agent": TEST_UA
  }
});

// Delete the entire status field and sessions after each test
const withCleanup = getCleanupWrapper({
  after() {
    lastLoginAdvice = null;
    lastLogoutAdvice = null;
    lastIdleAdvice = null;
    lastActiveAdvice = null;

    Meteor.users.update(TEST_userId, {
      $unset: {
        status: null
      }
    });
    UserStatus.connections.remove({
      $or: [{
          userId: TEST_userId
        },
        {
          ipAddr: TEST_IP
        }
      ]
    });

    return Deps.flush();
  }
});

// Clean up before we add any tests just in case some crap left over from before
withCleanup(function () {});

Tinytest.add("status - adding anonymous session", withCleanup(function (test) {
  const conn = randomConnection();

  StatusInternals.addSession(conn);

  const doc = UserStatus.connections.findOne(conn.id);

  test.isTrue(doc != null);
  test.equal(doc._id, conn.id);
  test.equal(doc.ipAddr, TEST_IP);
  test.equal(doc.userAgent, TEST_UA);
  test.isFalse(doc.userId);
  return test.isFalse(doc.loginTime);
}));

Tinytest.add("status - adding and removing anonymous session", withCleanup(function (test) {
  const conn = randomConnection();

  StatusInternals.addSession(conn);
  StatusInternals.removeSession(conn, delayedDate());

  return test.isFalse(UserStatus.connections.findOne(conn.id));
}));

Tinytest.add("status - adding one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const doc = UserStatus.connections.findOne(conn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isTrue(doc != null);
  test.equal(doc._id, conn.id);
  test.equal(doc.userId, TEST_userId);
  test.equal(doc.loginTime, ts);
  test.equal(doc.ipAddr, TEST_IP);
  test.equal(doc.userAgent, TEST_UA);

  test.equal(lastLoginAdvice.userId, TEST_userId);
  test.equal(lastLoginAdvice.connectionId, conn.id);
  test.equal(lastLoginAdvice.loginTime, ts);
  test.equal(lastLoginAdvice.ipAddr, TEST_IP);
  test.equal(lastLoginAdvice.userAgent, TEST_UA);

  test.equal(user.status.online, true);
  test.equal(user.status.idle, false);
  test.equal(user.status.lastLogin.date, ts);
  return test.equal(user.status.lastLogin.userAgent, TEST_UA);
}));

Tinytest.add("status - adding and removing one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const logoutTime = delayedDate();
  StatusInternals.removeSession(conn, logoutTime);

  const doc = UserStatus.connections.findOne(conn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isFalse(doc != null);

  test.equal(lastLogoutAdvice.userId, TEST_userId);
  test.equal(lastLogoutAdvice.connectionId, conn.id);
  test.equal(lastLogoutAdvice.logoutTime, logoutTime);
  test.isFalse(lastLogoutAdvice.lastActivity != null);

  test.equal(user.status.online, false);
  test.isFalse(user.status.idle != null);
  return test.equal(user.status.lastLogin.date, ts);
}));

Tinytest.add("status - logout and then close one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const logoutTime = delayedDate();
  StatusInternals.tryLogoutSession(conn, logoutTime);

  test.equal(lastLogoutAdvice.userId, TEST_userId);
  test.equal(lastLogoutAdvice.connectionId, conn.id);
  test.equal(lastLogoutAdvice.logoutTime, logoutTime);
  test.isFalse(lastLogoutAdvice.lastActivity != null);

  lastLogoutAdvice = null;
  // After logging out, the user closes the browser, which triggers a close callback
  // However, the event should not be emitted again
  const closeTime = delayedDate();
  StatusInternals.removeSession(conn, closeTime);

  const doc = UserStatus.connections.findOne(conn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isFalse(doc != null);
  test.isFalse(lastLogoutAdvice != null);

  test.equal(user.status.online, false);
  test.isFalse(user.status.idle != null);
  return test.equal(user.status.lastLogin.date, ts);
}));

Tinytest.add("status - idling one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const idleTime = delayedDate();

  StatusInternals.idleSession(conn, idleTime, TEST_userId);

  const doc = UserStatus.connections.findOne(conn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isTrue(doc != null);
  test.equal(doc._id, conn.id);
  test.equal(doc.userId, TEST_userId);
  test.equal(doc.loginTime, ts);
  test.equal(doc.ipAddr, TEST_IP);
  test.equal(doc.userAgent, TEST_UA);
  test.equal(doc.idle, true);
  test.equal(doc.lastActivity, idleTime);

  test.equal(lastIdleAdvice.userId, TEST_userId);
  test.equal(lastIdleAdvice.connectionId, conn.id);
  test.equal(lastIdleAdvice.lastActivity, idleTime);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts);
  test.equal(user.status.idle, true);
  return test.equal(user.status.lastActivity, idleTime);
}));

Tinytest.add("status - idling and reactivating one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const idleTime = delayedDate();
  StatusInternals.idleSession(conn, idleTime, TEST_userId);
  const activeTime = delayedDate();
  StatusInternals.activeSession(conn, activeTime, TEST_userId);

  const doc = UserStatus.connections.findOne(conn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isTrue(doc != null);
  test.equal(doc._id, conn.id);
  test.equal(doc.userId, TEST_userId);
  test.equal(doc.loginTime, ts);
  test.equal(doc.ipAddr, TEST_IP);
  test.equal(doc.userAgent, TEST_UA);
  test.equal(doc.idle, false);
  test.isFalse(doc.lastActivity != null);

  test.equal(lastActiveAdvice.userId, TEST_userId);
  test.equal(lastActiveAdvice.connectionId, conn.id);
  test.equal(lastActiveAdvice.lastActivity, activeTime);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

Tinytest.add("status - idling and removing one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);
  const idleTime = delayedDate();
  StatusInternals.idleSession(conn, idleTime, TEST_userId);
  const logoutTime = delayedDate();
  StatusInternals.removeSession(conn, logoutTime);

  const doc = UserStatus.connections.findOne(conn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isFalse(doc != null);

  test.equal(lastLogoutAdvice.userId, TEST_userId);
  test.equal(lastLogoutAdvice.connectionId, conn.id);
  test.equal(lastLogoutAdvice.logoutTime, logoutTime);
  test.equal(lastLogoutAdvice.lastActivity, idleTime);

  test.equal(user.status.online, false);
  return test.equal(user.status.lastLogin.date, ts);
}));

Tinytest.add("status - idling and reconnecting one authenticated session", withCleanup(function (test) {
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);
  const idleTime = delayedDate();
  StatusInternals.idleSession(conn, idleTime, TEST_userId);

  // Session reconnects but was idle

  const discTime = delayedDate();
  StatusInternals.removeSession(conn, discTime);

  const reconn = randomConnection();
  const reconnTime = delayedDate();

  StatusInternals.addSession(reconn);
  StatusInternals.loginSession(reconn, reconnTime, TEST_userId);
  StatusInternals.idleSession(reconn, idleTime, TEST_userId);

  const doc = UserStatus.connections.findOne(reconn.id);
  const user = Meteor.users.findOne(TEST_userId);

  test.isTrue(doc != null);
  test.equal(doc._id, reconn.id);
  test.equal(doc.userId, TEST_userId);
  test.equal(doc.loginTime, reconnTime);
  test.equal(doc.ipAddr, TEST_IP);
  test.equal(doc.userAgent, TEST_UA);
  test.equal(doc.idle, true);
  test.equal(doc.lastActivity, idleTime);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, reconnTime);
  test.equal(user.status.idle, true);
  return test.equal(user.status.lastActivity, idleTime);
}));

Tinytest.add("multiplex - two online sessions", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  return test.equal(user.status.lastLogin.date, ts2);
}));

Tinytest.add("multiplex - two online sessions with one going offline", withCleanup(function (test) {
  let user;
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  StatusInternals.removeSession(conn, delayedDate(),

    (user = Meteor.users.findOne(TEST_userId)));

  test.equal(user.status.online, true);
  return test.equal(user.status.lastLogin.date, ts2);
}));

Tinytest.add("multiplex - two online sessions to offline", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  StatusInternals.removeSession(conn, delayedDate());
  StatusInternals.removeSession(conn2, delayedDate());

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, false);
  return test.equal(user.status.lastLogin.date, ts2);
}));

Tinytest.add("multiplex - idling one of two online sessions", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  StatusInternals.idleSession(conn, idle1, TEST_userId);

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  return test.equal(user.status.idle, false);
}));

Tinytest.add("multiplex - idling two online sessions", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  const idle2 = delayedDate();
  StatusInternals.idleSession(conn, idle1, TEST_userId);
  StatusInternals.idleSession(conn2, idle2, TEST_userId);

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, true);
  return test.equal(user.status.lastActivity, idle2);
}));

Tinytest.add("multiplex - idling two then reactivating one session", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  const idle2 = delayedDate();
  StatusInternals.idleSession(conn, idle1, TEST_userId);
  StatusInternals.idleSession(conn2, idle2, TEST_userId);

  StatusInternals.activeSession(conn, delayedDate(), TEST_userId);

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

Tinytest.add("multiplex - logging in while an existing session is idle", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const idle1 = delayedDate();
  StatusInternals.idleSession(conn, idle1, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

Tinytest.add("multiplex - simulate tab switch", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  // open first tab then becomes idle
  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const idle1 = delayedDate();
  StatusInternals.idleSession(conn, idle1, TEST_userId);

  // open second tab then becomes idle
  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);
  const idle2 = delayedDate();
  StatusInternals.idleSession(conn2, idle2, TEST_userId);

  // go back to first tab
  StatusInternals.activeSession(conn, delayedDate(), TEST_userId);

  const user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

// Test for idling one session across a disconnection; not most recent idle time
Tinytest.add("multiplex - disconnection and reconnection while idle", withCleanup(function (test) {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  StatusInternals.addSession(conn2);
  StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  StatusInternals.idleSession(conn, idle1, TEST_userId);
  const idle2 = delayedDate();
  StatusInternals.idleSession(conn2, idle2, TEST_userId);

  // Second session, which connected later, reconnects but remains idle
  StatusInternals.removeSession(conn2, delayedDate(), TEST_userId);

  let user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, true);
  test.equal(user.status.lastActivity, idle2);

  const reconn2 = randomConnection();

  const ts3 = delayedDate();
  StatusInternals.addSession(reconn2);
  StatusInternals.loginSession(reconn2, ts3, TEST_userId);

  StatusInternals.idleSession(reconn2, idle2, TEST_userId);

  user = Meteor.users.findOne(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts3);
  test.equal(user.status.idle, true);
  return test.equal(user.status.lastActivity, idle2);
}));

Tinytest.add("status - user online set to false on startup", withCleanup(function (test) {
  // special argument to onStartup prevents this from affecting client tests
  StatusInternals.onStartup(TEST_userId);

  const userAfterStartup = Meteor.users.findOne(TEST_userId);
  // Check reset status
  test.equal(userAfterStartup.status.online, false);
  test.equal(userAfterStartup.status.idle, undefined);
  test.equal(userAfterStartup.status.lastActivity, undefined);

  // Make user come online, then restart the server
  const conn = randomConnection();
  const ts = delayedDate();

  StatusInternals.addSession(conn);
  StatusInternals.loginSession(conn, ts, TEST_userId);

  const userAfterLogin = Meteor.users.findOne(TEST_userId);

  test.equal(userAfterLogin.status.online, true);
  test.isFalse(userAfterLogin.status.idle);

  StatusInternals.onStartup(TEST_userId);

  const userAfterRestart = Meteor.users.findOne(TEST_userId);
  // Check reset status again
  test.equal(userAfterRestart.status.online, false);
  test.equal(userAfterRestart.status.idle, undefined);
  return test.equal(userAfterRestart.status.lastActivity, undefined);
}));