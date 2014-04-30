lastLoginAdvice = null
lastLogoutAdvice = null
lastIdleAdvice = null
lastActiveAdvice = null

# Record events for tests
UserStatus.events.on "connectionLogin", (advice) -> lastLoginAdvice = advice
UserStatus.events.on "connectionLogout", (advice) -> lastLogoutAdvice = advice
UserStatus.events.on "connectionIdle", (advice) -> lastIdleAdvice = advice
UserStatus.events.on "connectionActive", (advice) -> lastActiveAdvice = advice

# Make sure repeated calls to this return different values
delayedDate = ->
  Meteor._wrapAsync((cb) -> Meteor.setTimeout (-> cb undefined, new Date()), 1)()

# Delete the entire status field and sessions after each test
withCleanup = getCleanupWrapper
  after: ->
    lastLoginAdvice = null
    lastLogoutAdvice = null
    lastIdleAdvice = null
    lastActiveAdvice = null

    Meteor.users.update TEST_userId,
      $unset: status: null
    UserStatus.connections.remove { userId: TEST_userId }

    Meteor.flush()

# Clean up before we add any tests just in case some crap left over from before
withCleanup ->

Tinytest.add "status - adding one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip

  doc = UserStatus.connections.findOne conn
  user = Meteor.users.findOne TEST_userId

  test.isTrue doc?
  test.equal doc._id, conn
  test.equal doc.userId, TEST_userId
  test.equal doc.loginTime, ts
  test.equal doc.ipAddr, ip

  test.equal lastLoginAdvice.userId, TEST_userId
  test.equal lastLoginAdvice.connectionId, conn
  test.equal lastLoginAdvice.loginTime, ts
  test.equal lastLoginAdvice.ipAddr, ip

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts

Tinytest.add "status - adding and removing one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  logoutTime = delayedDate()
  StatusInternals.removeSession TEST_userId, conn, logoutTime

  doc = UserStatus.connections.findOne conn
  user = Meteor.users.findOne TEST_userId

  test.isFalse doc?

  test.equal lastLogoutAdvice.userId, TEST_userId
  test.equal lastLogoutAdvice.connectionId, conn
  test.equal lastLogoutAdvice.logoutTime, logoutTime
  test.isFalse lastLogoutAdvice.lastActivity?

  test.equal user.status.online, false
  test.equal user.status.lastLogin, ts

Tinytest.add "status - logout and then close one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  logoutTime = delayedDate()
  StatusInternals.removeSession TEST_userId, conn, logoutTime

  lastLogoutAdvice = null
  # After logging out, the user closes the browser, which triggers a close callback
  # However, the event should not be emitted again
  closeTime = delayedDate()
  StatusInternals.removeSession TEST_userId, conn, closeTime

  doc = UserStatus.connections.findOne conn
  user = Meteor.users.findOne TEST_userId

  test.isFalse doc?
  test.isFalse lastLogoutAdvice?

  test.equal user.status.online, false
  test.equal user.status.lastLogin, ts

Tinytest.add "status - idling one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  idleTime = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idleTime

  doc = UserStatus.connections.findOne conn
  user = Meteor.users.findOne TEST_userId

  test.isTrue doc?
  test.equal doc._id, conn
  test.equal doc.userId, TEST_userId
  test.equal doc.loginTime, ts
  test.equal doc.ipAddr, ip
  test.equal doc.idle, true
  test.equal doc.lastActivity, idleTime

  test.equal lastIdleAdvice.userId, TEST_userId
  test.equal lastIdleAdvice.connectionId, conn
  test.equal lastIdleAdvice.lastActivity, idleTime

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts
  test.equal user.status.idle, true
  test.equal user.status.lastActivity, idleTime

Tinytest.add "status - idling and reactivating one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  idleTime = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idleTime
  activeTime = delayedDate()
  StatusInternals.activeSession TEST_userId, conn, activeTime

  doc = UserStatus.connections.findOne conn
  user = Meteor.users.findOne TEST_userId

  test.isTrue doc?
  test.equal doc._id, conn
  test.equal doc.userId, TEST_userId
  test.equal doc.loginTime, ts
  test.equal doc.ipAddr, ip
  test.equal doc.idle, false
  test.isFalse doc.lastActivity?

  test.equal lastActiveAdvice.userId, TEST_userId
  test.equal lastActiveAdvice.connectionId, conn
  test.equal lastActiveAdvice.lastActivity, activeTime

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts
  test.isFalse user.status.idle?,
  test.isFalse user.status.lastActivity?

Tinytest.add "status - idling and removing one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  idleTime = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idleTime
  logoutTime = delayedDate()
  StatusInternals.removeSession TEST_userId, conn, logoutTime

  doc = UserStatus.connections.findOne conn
  user = Meteor.users.findOne TEST_userId

  test.isFalse doc?

  test.equal lastLogoutAdvice.userId, TEST_userId
  test.equal lastLogoutAdvice.connectionId, conn
  test.equal lastLogoutAdvice.logoutTime, logoutTime
  test.equal lastLogoutAdvice.lastActivity, idleTime

  test.equal user.status.online, false
  test.equal user.status.lastLogin, ts

Tinytest.add "status - idling and reconnecting one session", withCleanup (test) ->
  conn = Random.id()
  ts = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  idleTime = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idleTime

  # Session reconnects but was idle

  discTime = delayedDate()
  StatusInternals.removeSession TEST_userId, conn, discTime

  reconn = Random.id()
  reconnTime = delayedDate()
  StatusInternals.addSession TEST_userId, reconn, reconnTime, ip
  StatusInternals.idleSession TEST_userId, reconn, idleTime

  doc = UserStatus.connections.findOne reconn
  user = Meteor.users.findOne TEST_userId

  test.isTrue doc?
  test.equal doc._id, reconn
  test.equal doc.userId, TEST_userId
  test.equal doc.loginTime, reconnTime,
  test.equal doc.ipAddr, ip
  test.equal doc.idle, true
  test.equal doc.lastActivity, idleTime

  test.equal user.status.online, true
  test.equal user.status.lastLogin, reconnTime
  test.equal user.status.idle, true
  test.equal user.status.lastActivity, idleTime

Tinytest.add "multiplex - two online sessions", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2

Tinytest.add "multiplex - two online sessions with one going offline", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  StatusInternals.removeSession TEST_userId, conn, delayedDate(),

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2

Tinytest.add "multiplex - two online sessions to offline", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  StatusInternals.removeSession TEST_userId, conn, delayedDate()
  StatusInternals.removeSession TEST_userId, conn2, delayedDate()

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, false
  test.equal user.status.lastLogin, ts2

Tinytest.add "multiplex - idling one of two online sessions", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  idle1 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idle1

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2
  test.isFalse user.status.idle?

Tinytest.add "multiplex - idling two online sessions", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  idle1 = delayedDate()
  idle2 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idle1
  StatusInternals.idleSession TEST_userId, conn2, idle2

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2
  test.equal user.status.idle, true
  test.equal user.status.lastActivity, idle2

Tinytest.add "multiplex - idling two then reactivating one session", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  idle1 = delayedDate()
  idle2 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idle1
  StatusInternals.idleSession TEST_userId, conn2, idle2

  StatusInternals.activeSession TEST_userId, conn, delayedDate()

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2
  test.isFalse user.status.idle?
  test.isFalse user.status.lastActivity?

Tinytest.add "multiplex - simulate tab switch", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  # open first tab then becomes idle
  StatusInternals.addSession TEST_userId, conn, ts, ip
  idle1 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idle1

  # open second tab then becomes idle
  StatusInternals.addSession TEST_userId, conn2, ts2, ip
  idle2 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn2, idle2

  # go back to first tab
  StatusInternals.activeSession TEST_userId, conn, delayedDate()

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2
  test.isFalse user.status.idle?
  test.isFalse user.status.lastActivity?

# Test for idling one session across a disconnection; not most recent idle time
Tinytest.add "multiplex - disconnection and reconnection while idle", withCleanup (test) ->
  conn = Random.id()
  conn2 = Random.id()
  ts = delayedDate()
  ts2 = delayedDate()
  ip = "127.0.0.1"

  StatusInternals.addSession TEST_userId, conn, ts, ip
  StatusInternals.addSession TEST_userId, conn2, ts2, ip

  idle1 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn, idle1
  idle2 = delayedDate()
  StatusInternals.idleSession TEST_userId, conn2, idle2

  # Second session, which connected later, reconnects but remains idle
  StatusInternals.removeSession TEST_userId, conn2, delayedDate()

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts2
  test.equal user.status.idle, true
  test.equal user.status.lastActivity, idle2

  reconn2 = Random.id()
  ts3 = delayedDate()
  StatusInternals.addSession TEST_userId, reconn2, ts3
  StatusInternals.idleSession TEST_userId, reconn2, idle2

  user = Meteor.users.findOne TEST_userId

  test.equal user.status.online, true
  test.equal user.status.lastLogin, ts3
  test.equal user.status.idle, true
  test.equal user.status.lastActivity, idle2





