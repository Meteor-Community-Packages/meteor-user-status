/* globals Tinytest */
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Tracker } from 'meteor/tracker';
import { StatusInternals, UserStatus } from '../server/status';
import { ensureTestUser, getCleanupWrapper, TEST_IP, TEST_userId } from './setup';

let lastLoginAdvice = null;
let lastLogoutAdvice = null;
let lastIdleAdvice = null;
let lastActiveAdvice = null;

// Record events for tests
UserStatus.events.on('connectionLogin', advice => lastLoginAdvice = advice);
UserStatus.events.on('connectionLogout', advice => lastLogoutAdvice = advice);
UserStatus.events.on('connectionIdle', advice => lastIdleAdvice = advice);
UserStatus.events.on('connectionActive', advice => lastActiveAdvice = advice);

const TEST_UA = 'old-ass browser';

let lastDateTime = Date.now();
// Make sure repeated calls to this return different values
const delayedDate = () => new Date(++lastDateTime);

const randomConnection = () => ({
  id: Random.id(),
  clientAddress: TEST_IP,

  httpHeaders: {
    'user-agent': TEST_UA
  }
});

// Delete the entire status field and sessions after each test
const withCleanup = getCleanupWrapper({
  async before() {
    await ensureTestUser();
  },

  async after() {
    lastLoginAdvice = null;
    lastLogoutAdvice = null;
    lastIdleAdvice = null;
    lastActiveAdvice = null;

    await Meteor.users.updateAsync(TEST_userId, {
      $unset: {
        status: null
      }
    });
    await UserStatus.connections.removeAsync({
      $or: [{
          userId: TEST_userId
        },
        {
          ipAddr: TEST_IP
        }
      ]
    });

    return Tracker.flush();
  }
});

// Clean up before we add any tests just in case some crap left over from before
withCleanup(function () {});

Tinytest.addAsync('status - adding anonymous session', withCleanup(async (test) => {
  const conn = randomConnection();

  await StatusInternals.addSession(conn);

  const doc = await UserStatus.connections.findOneAsync(conn.id);

  test.isTrue(doc != null);
  test.equal(doc._id, conn.id);
  test.equal(doc.ipAddr, TEST_IP);
  test.equal(doc.userAgent, TEST_UA);
  test.isFalse(doc.userId);
  return test.isFalse(doc.loginTime);
}));

Tinytest.addAsync('status - adding and removing anonymous session', withCleanup(async (test) => {
  const conn = randomConnection();

  await StatusInternals.addSession(conn);
  await StatusInternals.removeSession(conn, delayedDate());

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  return test.isFalse(doc != null);
}));

Tinytest.addAsync('status - adding one authenticated session', withCleanup(async(test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

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

Tinytest.addAsync('status - adding and removing one authenticated session', withCleanup(async(test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const logoutTime = delayedDate();
  await StatusInternals.removeSession(conn, logoutTime);

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.isFalse(doc != null);

  test.equal(lastLogoutAdvice.userId, TEST_userId);
  test.equal(lastLogoutAdvice.connectionId, conn.id);
  test.equal(lastLogoutAdvice.logoutTime, logoutTime);
  test.isFalse(lastLogoutAdvice.lastActivity != null);

  test.equal(user.status.online, false);
  test.isFalse(user.status.idle != null);
  return test.equal(user.status.lastLogin.date, ts);
}));

Tinytest.addAsync('status - logout and then close one authenticated session', withCleanup(async (test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const logoutTime = delayedDate();
  await StatusInternals.tryLogoutSession(conn, logoutTime);

  test.equal(lastLogoutAdvice.userId, TEST_userId);
  test.equal(lastLogoutAdvice.connectionId, conn.id);
  test.equal(lastLogoutAdvice.logoutTime, logoutTime);
  test.isFalse(lastLogoutAdvice.lastActivity != null);

  lastLogoutAdvice = null;
  // After logging out, the user closes the browser, which triggers a close callback
  // However, the event should not be emitted again
  const closeTime = delayedDate();
  await StatusInternals.removeSession(conn, closeTime);

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.isFalse(doc != null);
  test.isFalse(lastLogoutAdvice != null);

  test.equal(user.status.online, false);
  test.isFalse(user.status.idle != null);
  return test.equal(user.status.lastLogin.date, ts);
}));

Tinytest.addAsync('status - idling one authenticated session', withCleanup(async(test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const idleTime = delayedDate();

  await StatusInternals.idleSession(conn, idleTime, TEST_userId);

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

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

Tinytest.addAsync('status - idling and reactivating one authenticated session', withCleanup(async(test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const idleTime = delayedDate();
  await StatusInternals.idleSession(conn, idleTime, TEST_userId);
  const activeTime = delayedDate();
  await StatusInternals.activeSession(conn, activeTime, TEST_userId);

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

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

Tinytest.addAsync('status - idling and removing one authenticated session', withCleanup(async(test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);
  const idleTime = delayedDate();
  await StatusInternals.idleSession(conn, idleTime, TEST_userId);
  const logoutTime = delayedDate();
  await StatusInternals.removeSession(conn, logoutTime);

  const doc = await UserStatus.connections.findOneAsync(conn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.isFalse(doc != null);

  test.equal(lastLogoutAdvice.userId, TEST_userId);
  test.equal(lastLogoutAdvice.connectionId, conn.id);
  test.equal(lastLogoutAdvice.logoutTime, logoutTime);
  test.equal(lastLogoutAdvice.lastActivity, idleTime);

  test.equal(user.status.online, false);
  return test.equal(user.status.lastLogin.date, ts);
}));

Tinytest.addAsync('status - idling and reconnecting one authenticated session', withCleanup(async(test) => {
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);
  const idleTime = delayedDate();
  await StatusInternals.idleSession(conn, idleTime, TEST_userId);

  // Session reconnects but was idle

  const discTime = delayedDate();
  await StatusInternals.removeSession(conn, discTime);

  const reconn = randomConnection();
  const reconnTime = delayedDate();

  await StatusInternals.addSession(reconn);
  await StatusInternals.loginSession(reconn, reconnTime, TEST_userId);
  await StatusInternals.idleSession(reconn, idleTime, TEST_userId);

  const doc = await UserStatus.connections.findOneAsync(reconn.id);
  const user = await Meteor.users.findOneAsync(TEST_userId);

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

Tinytest.addAsync('multiplex - two online sessions', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  return test.equal(user.status.lastLogin.date, ts2);
}));

Tinytest.addAsync('multiplex - two online sessions with one going offline', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  await StatusInternals.removeSession(conn, delayedDate());
  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  return test.equal(user.status.lastLogin.date, ts2);
}));

Tinytest.addAsync('multiplex - two online sessions to offline', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  await StatusInternals.removeSession(conn, delayedDate());
  await StatusInternals.removeSession(conn2, delayedDate());

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, false);
  return test.equal(user.status.lastLogin.date, ts2);
}));

Tinytest.addAsync('multiplex - idling one of two online sessions', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  await StatusInternals.idleSession(conn, idle1, TEST_userId);

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  return test.equal(user.status.idle, false);
}));

Tinytest.addAsync('multiplex - idling two online sessions', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  const idle2 = delayedDate();
  await StatusInternals.idleSession(conn, idle1, TEST_userId);
  await StatusInternals.idleSession(conn2, idle2, TEST_userId);

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, true);
  return test.equal(user.status.lastActivity, idle2);
}));

Tinytest.addAsync('multiplex - idling two then reactivating one session', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  const idle2 = delayedDate();
  await StatusInternals.idleSession(conn, idle1, TEST_userId);
  await StatusInternals.idleSession(conn2, idle2, TEST_userId);

  await StatusInternals.activeSession(conn, delayedDate(), TEST_userId);

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

Tinytest.addAsync('multiplex - logging in while an existing session is idle', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const idle1 = delayedDate();
  await StatusInternals.idleSession(conn, idle1, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

Tinytest.addAsync('multiplex - simulate tab switch', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  // open first tab then becomes idle
  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const idle1 = delayedDate();
  await StatusInternals.idleSession(conn, idle1, TEST_userId);

  // open second tab then becomes idle
  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);
  const idle2 = delayedDate();
  await StatusInternals.idleSession(conn2, idle2, TEST_userId);

  // go back to first tab
  await StatusInternals.activeSession(conn, delayedDate(), TEST_userId);

  const user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, false);
  return test.isFalse(user.status.lastActivity != null);
}));

// Test for idling one session across a disconnection; not most recent idle time
Tinytest.addAsync('multiplex - disconnection and reconnection while idle', withCleanup(async (test) => {
  const conn = randomConnection();

  const conn2 = randomConnection();

  const ts = delayedDate();
  const ts2 = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  await StatusInternals.addSession(conn2);
  await StatusInternals.loginSession(conn2, ts2, TEST_userId);

  const idle1 = delayedDate();
  await StatusInternals.idleSession(conn, idle1, TEST_userId);
  const idle2 = delayedDate();
  await StatusInternals.idleSession(conn2, idle2, TEST_userId);

  // Second session, which connected later, reconnects but remains idle
  await StatusInternals.removeSession(conn2, delayedDate(), TEST_userId);

  let user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts2);
  test.equal(user.status.idle, true);
  test.equal(user.status.lastActivity, idle2);

  const reconn2 = randomConnection();

  const ts3 = delayedDate();
  await StatusInternals.addSession(reconn2);
  await StatusInternals.loginSession(reconn2, ts3, TEST_userId);

  await StatusInternals.idleSession(reconn2, idle2, TEST_userId);

  user = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(user.status.online, true);
  test.equal(user.status.lastLogin.date, ts3);
  test.equal(user.status.idle, true);
  return test.equal(user.status.lastActivity, idle2);
}));

Tinytest.addAsync('status - user online set to false on startup', withCleanup(async (test) => {
  // special argument to onStartup prevents this from affecting client tests
  await StatusInternals.onStartup(TEST_userId);

  const userAfterStartup = await Meteor.users.findOneAsync(TEST_userId);
  // Check reset status
  test.equal(userAfterStartup.status.online, false);
  test.equal(userAfterStartup.status.idle, undefined);
  test.equal(userAfterStartup.status.lastActivity, undefined);

  // Make user come online, then restart the server
  const conn = randomConnection();
  const ts = delayedDate();

  await StatusInternals.addSession(conn);
  await StatusInternals.loginSession(conn, ts, TEST_userId);

  const userAfterLogin = await Meteor.users.findOneAsync(TEST_userId);

  test.equal(userAfterLogin.status.online, true);
  test.isFalse(userAfterLogin.status.idle);

  await StatusInternals.onStartup(TEST_userId);

  const userAfterRestart = await Meteor.users.findOneAsync(TEST_userId);
  // Check reset status again
  test.equal(userAfterRestart.status.online, false);
  test.equal(userAfterRestart.status.idle, undefined);
  return test.equal(userAfterRestart.status.lastActivity, undefined);
}));
