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

###
  TODO: Add client-side tests as well

  - Disconnect / reconnect while idle
  - Start monitor with window blurred (and idleOnBlur)
  - Skip actions when window blurred (and idleOnBlur)
  - Unset idleness when stopping monitor
###
