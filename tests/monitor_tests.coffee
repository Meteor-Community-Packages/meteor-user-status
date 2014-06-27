tolMs = 100
reportedEvents = []

# Stub out reporting methods for testing
MonitorInternals.reportIdle = (time) ->
  reportedEvents.push
    status: "idle"
    time: time

MonitorInternals.reportActive = (time) ->
  reportedEvents.push
    status: "active"
    time: time

# Test function wrapper that cleans up reported events array
withCleanup = getCleanupWrapper
  before: ->
    MonitorInternals.onWindowFocus()
    MonitorInternals.idleThreshold = null
    MonitorInternals.idleOnBlur = false
    # http://stackoverflow.com/a/1232046/586086
    reportedEvents.length = 0

  after: ->
    try
      UserStatus.stopMonitor()

# This is a 2x2 test of all possible cases

Tinytest.add "monitor - idleOnBlur and window blurred", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = true

  activity = Date.now()
  newTime = activity + 120000

  test.equal MonitorInternals.computeState(activity, activity, false), true
  # Should not change if we go idle
  test.equal MonitorInternals.computeState(activity, newTime, false), true

Tinytest.add "monitor - idleOnBlur and window focused", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = true

  activity = Date.now()
  newTime = activity + 120000

  test.equal MonitorInternals.computeState(activity, activity, true), false
  # Should change if we go idle
  test.equal MonitorInternals.computeState(activity, newTime, true), true

Tinytest.add "monitor - idle below threshold", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = false

  activity = Date.now()
  test.equal MonitorInternals.computeState(activity, activity, true), false
  # Shouldn't change if we go out of focus
  test.equal MonitorInternals.computeState(activity, activity, false), false

Tinytest.add "monitor - idle above threshold", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = false

  activity = Date.now()
  newTime = activity + 120000

  test.equal MonitorInternals.computeState(activity, newTime, true), true
  # Shouldn't change if we go out of focus
  test.equal MonitorInternals.computeState(activity, newTime, false), true

# We need to wait for TimeSync to run or errors will ensue.
Tinytest.addAsync "monitor - wait for timesync", (test, next) ->
  Deps.autorun (c) ->
    if TimeSync.isSynced()
      c.stop()
      next()

Tinytest.add "monitor - start with default settings", withCleanup (test) ->
  UserStatus.startMonitor()

  test.equal UserStatus.isMonitoring(), true
  test.isTrue UserStatus.lastActivity()

  test.equal MonitorInternals.idleThreshold, 60000
  test.equal MonitorInternals.idleOnBlur, false

Tinytest.add "monitor - start with window focused, and idleOnBlur = false", withCleanup (test) ->
  UserStatus.startMonitor
    threshold: 30000
    idleOnBlur: false

  timestamp = Deps.nonreactive -> TimeSync.serverTime()

  test.equal MonitorInternals.idleThreshold, 30000
  test.equal MonitorInternals.idleOnBlur, false

  Deps.flush()

  test.equal UserStatus.isIdle(), false
  test.isTrue Math.abs(UserStatus.lastActivity() - timestamp) < tolMs
  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "active"
  test.isTrue Math.abs(reportedEvents[0]?.time - timestamp) < tolMs

Tinytest.add "monitor - start with window focused, and idleOnBlur = true", withCleanup (test) ->
  UserStatus.startMonitor
    threshold: 30000
    idleOnBlur: true

  timestamp = Deps.nonreactive -> TimeSync.serverTime()

  test.equal MonitorInternals.idleThreshold, 30000
  test.equal MonitorInternals.idleOnBlur, true

  Deps.flush()

  test.equal UserStatus.isIdle(), false
  test.isTrue Math.abs(UserStatus.lastActivity() - timestamp) < tolMs
  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "active"
  test.isTrue Math.abs(reportedEvents[0]?.time - timestamp) < tolMs

Tinytest.add "monitor - start with window blurred, and idleOnBlur = false", withCleanup (test) ->
  MonitorInternals.onWindowBlur()

  UserStatus.startMonitor
    threshold: 30000
    idleOnBlur: false

  timestamp = Deps.nonreactive -> TimeSync.serverTime()

  test.equal MonitorInternals.idleThreshold, 30000
  test.equal MonitorInternals.idleOnBlur, false

  Deps.flush()

  test.equal UserStatus.isIdle(), false
  test.isTrue Math.abs(UserStatus.lastActivity() - timestamp) < tolMs
  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "active"
  test.isTrue Math.abs(reportedEvents[0]?.time - timestamp) < tolMs

Tinytest.add "monitor - start with window blurred, and idleOnBlur = true", withCleanup (test) ->
  MonitorInternals.onWindowBlur()

  UserStatus.startMonitor
    threshold: 30000
    idleOnBlur: true

  timestamp = Deps.nonreactive -> TimeSync.serverTime()

  test.equal MonitorInternals.idleThreshold, 30000
  test.equal MonitorInternals.idleOnBlur, true

  Deps.flush()

  test.equal UserStatus.isIdle(), true
  test.isTrue Math.abs(UserStatus.lastActivity() - timestamp) < tolMs
  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "idle"
  test.isTrue Math.abs(reportedEvents[0]?.time - timestamp) < tolMs

Tinytest.add "monitor - ignore actions when window is blurred with idleOnBlur = true", withCleanup (test) ->

  UserStatus.startMonitor
    idleOnBlur: true
  Deps.flush()

  startTime = UserStatus.lastActivity()

  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "active"
  test.isTrue Math.abs(reportedEvents[0]?.time - startTime) < tolMs

  MonitorInternals.onWindowBlur()
  Deps.flush()

  test.length reportedEvents, 2
  test.equal reportedEvents[1]?.status, "idle"

  UserStatus.pingMonitor()

  # Shouldn't have changed
  test.length reportedEvents, 2
  test.equal UserStatus.lastActivity(), startTime

Tinytest.add "monitor - stopping while idle unsets idle state", withCleanup (test) ->

  UserStatus.startMonitor
    idleOnBlur: true
  Deps.flush()

  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "active"

  startTime = UserStatus.lastActivity()

  # Simulate going idle immediately using blur
  MonitorInternals.onWindowBlur()
  Deps.flush()

  test.length reportedEvents, 2
  test.equal reportedEvents[1]?.status, "idle"

  test.equal UserStatus.isIdle(), true
  test.equal UserStatus.lastActivity(), startTime

  UserStatus.stopMonitor()
  Deps.flush()

  test.length reportedEvents, 3
  test.equal reportedEvents[2]?.status, "active"

  test.equal UserStatus.isIdle(), false
  test.equal UserStatus.lastActivity(), undefined

Tinytest.addAsync "monitor - stopping and restarting grabs new start time", withCleanup (test, next) ->

  UserStatus.startMonitor
    idleOnBlur: true
  Deps.flush()

  start1 = UserStatus.lastActivity()

  UserStatus.stopMonitor()
  Deps.flush()

  Meteor.setTimeout ->
    UserStatus.startMonitor
      idleOnBlur: true
    Deps.flush()

    start2 = UserStatus.lastActivity()

    test.isTrue start2 > start1
    next()
  , 50

Tinytest.add "monitor - idle state reported across a disconnect", withCleanup (test) ->

  UserStatus.startMonitor
    idleOnBlur: true
  Deps.flush()

  test.length reportedEvents, 1
  test.equal reportedEvents[0]?.status, "active"

  # Simulate going idle immediately using blur
  MonitorInternals.onWindowBlur()
  Deps.flush()

  test.length reportedEvents, 2
  test.equal reportedEvents[1]?.status, "idle"

  MonitorInternals.connectionChange(false, true)
  MonitorInternals.connectionChange(true, false)

  test.length reportedEvents, 3
  test.equal reportedEvents[2]?.status, "idle"
