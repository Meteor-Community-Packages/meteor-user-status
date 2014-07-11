if Meteor.isClient
  @UserConnections = new Meteor.Collection("user_status_sessions")

  relativeTime = (timeAgo) ->
    diff = moment.utc(TimeSync.serverTime() - timeAgo)
    time = diff.format("H:mm:ss")
    days = +diff.format("DDD") - 1
    ago = (if days then days + "d " else "") + time
    return ago + " ago"

  Handlebars.registerHelper "userStatus", UserStatus
  Handlebars.registerHelper "localeTime", (date) -> date?.toLocaleString()
  Handlebars.registerHelper "relativeTime", relativeTime

  Template.login.loggedIn = -> Meteor.userId()

  Template.status.events =
    "submit form.start-monitor": (e, tmpl) ->
      e.preventDefault()
      UserStatus.startMonitor
        threshold: tmpl.find("input[name=threshold]").valueAsNumber
        interval: tmpl.find("input[name=interval]").valueAsNumber
        idleOnBlur: tmpl.find("select[name=idleOnBlur]").value is "true"

    "click .stop-monitor": -> UserStatus.stopMonitor()
    "click .resync": -> TimeSync.resync()

  Template.status.lastActivity = ->
    lastActivity = @lastActivity()
    if lastActivity?
      return relativeTime lastActivity
    else
      return "undefined"

  Template.status.serverTime = -> new Date(TimeSync.serverTime()).toLocaleString()
  Template.status.serverOffset = TimeSync.serverOffset
  Template.status.serverRTT = TimeSync.roundTripTime
  # Falsy values aren't rendered in templates, so let's render them ourself
  Template.status.isIdleText = -> @isIdle() || "false"
  Template.status.isMonitoringText = -> @isMonitoring() || "false"

  Template.serverStatus.anonymous = -> UserConnections.find(userId: $exists: false)
  Template.serverStatus.users = -> Meteor.users.find()
  Template.serverStatus.userClass = -> if @status?.idle then "warning" else "success"

  Template.serverStatus.connections = -> UserConnections.find(userId: @_id)

  Template.serverConnection.connectionClass = -> if @idle then "warning" else "success"
  Template.serverConnection.loginTime = ->
    return unless @loginTime?
    new Date(@loginTime).toLocaleString()

  Template.login.events =
    "submit form": (e, tmpl) ->
      e.preventDefault()
      input = tmpl.find("input[name=username]")
      input.blur()
      Meteor.insecureUserLogin input.value, (err, res) -> console.log(err) if err

  # Start monitor as soon as we got a signal, captain!
  Deps.autorun (c) ->
    try # May be an error if time is not synced
      UserStatus.startMonitor
        threshold: 30000
        idleOnBlur: true
      c.stop()

if Meteor.isServer
  # Try setting this so it works on meteor.com
  # (https://github.com/oortcloud/unofficial-meteor-faq)
  process.env.HTTP_FORWARDED_COUNT = 1

  Meteor.publish null, ->
    [
      Meteor.users.find { "status.online": true }, # online users only
        fields:
          status: 1,
          username: 1
      UserStatus.connections.find()
    ]
