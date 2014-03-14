###
  The idle monitor watches for mouse, keyboard, and blur events,
  and reports idle status to the server.

  It uses TimeSync to report accurate time.

  Everything is reactive, of course!
###


# TODO: catch window blur events where supported

monitorId = null
idleThreshold = null

inactiveDep = new Deps.Dependency
idle = false
lastActivity = undefined

start = (threshold, interval) ->
  throw new Error("Idle monitor is already active. Stop it first.") if monitorId

  threshold = 60000 unless threshold
  interval = 1000 unless interval

  # TODO Attach monitor events to window blur and body

  # Set new monitoring interval
  monitorId = Meteor.setInterval(monitor, interval)
  return

stop = ->
  throw new Error("Idle monitor is not running.") unless monitorId

  # Detach window events

  Meteor.clearInterval(monitorId)
  monitorId = null
  return

monitor = (isAction) ->
  currentTime = Deps.nonreactive(-> TimeSync.serverTime() )
  if isAction
    lastActivity = currentTime

  inactiveTime = currentTime - lastActivity

  if inactiveTime > idleThreshold and idle is false
    idle = true
    inactiveDep.changed()
  else if inactiveTime <= idleThreshold and idle is true
    idle = false
    inactiveDep.changed()

  return

touch = ->
  unless monitorId
    Meteor._debug("Cannot touch as idle monitor is not running.")
    return

  monitor(true) # Check for an idle state change right now

isIdle = ->
  inactiveDep.depend()
  return idle

Deps.autorun ->
  if isIdle()
    Meteor.call "user-status-idle", lastActivity
  else
    # Don't report the first time this function runs
    return unless lastActivity
    # If we were inactive, report that we are active again to the server
    Meteor.call "user-status-active", lastActivity

# TODO: export functions for starting and stopping idle monitor
UserStatus = {}
