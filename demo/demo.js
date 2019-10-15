import { Handlebars } from 'meteor/blaze';
import { Meteor } from 'meteor/meteor';
import { TimeSync } from 'meteor/mizzao:timesync';
import { Mongo } from 'meteor/mongo';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { UserStatus } from 'mizzao:user-status';
import { moment } from 'moment';
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
if (Meteor.isClient) {
  const UserConnections = new Mongo.Collection('user_status_sessions');

  const relativeTime = (timeAgo) => {
    const diff = moment.utc(TimeSync.serverTime() - timeAgo);
    const time = diff.format('H:mm:ss');
    const days = +diff.format('DDD') - 1;
    const ago = (days ? days + 'd ' : '') + time;
    return `${ago} ago`;
  };

  Handlebars.registerHelper('userStatus', UserStatus);
  Handlebars.registerHelper('localeTime', date => date != null ? date.toLocaleString() : undefined);
  Handlebars.registerHelper('relativeTime', relativeTime);

  Template.login.helpers({
    loggedIn() {
      return Meteor.userId();
    }
  });

  Template.status.events = {
    'submit form.start-monitor'(e, tmpl) {
      e.preventDefault();
      return UserStatus.startMonitor({
        threshold: tmpl.find('input[name=threshold]').valueAsNumber,
        interval: tmpl.find('input[name=interval]').valueAsNumber,
        idleOnBlur: tmpl.find('select[name=idleOnBlur]').value === 'true'
      });
    },

    'click .stop-monitor'() {
      return UserStatus.stopMonitor();
    },
    'click .resync'() {
      return TimeSync.resync();
    }
  };

  Template.status.helpers({
    lastActivity() {
      const lastActivity = this.lastActivity();
      if (lastActivity != null) {
        return relativeTime(lastActivity);
      } else {
        return 'undefined';
      }
    }
  });

  Template.status.helpers({
    serverTime() {
      return new Date(TimeSync.serverTime()).toLocaleString();
    },
    serverOffset: TimeSync.serverOffset,
    serverRTT: TimeSync.roundTripTime,

    // Falsy values aren't rendered in templates, so let's render them ourself
    isIdleText() {
      return this.isIdle() || 'false';
    },
    isMonitoringText() {
      return this.isMonitoring() || 'false';
    }
  });

  Template.serverStatus.helpers({
    anonymous() {
      return UserConnections.find({
        userId: {
          $exists: false
        }
      });
    },
    users() {
      return Meteor.users.find();
    },
    userClass() {
      if ((this.status != null ? this.status.idle : undefined)) {
        return 'warning';
      } else {
        return 'success';
      }
    },
    connections() {
      return UserConnections.find({
        userId: this._id
      });
    }
  });

  Template.serverConnection.helpers({
    connectionClass() {
      if (this.idle) {
        return 'warning';
      } else {
        return 'success';
      }
    },
    loginTime() {
      if (this.loginTime == null) {
        return;
      }
      return new Date(this.loginTime).toLocaleString();
    }
  });

  Template.login.events = {
    'submit form'(e, tmpl) {
      e.preventDefault();
      const input = tmpl.find('input[name=username]');
      input.blur();
      return Meteor.insecureUserLogin(input.value, (err) => {
        if (err) {
          return console.log(err);
        }
      });
    }
  };

  // Start monitor as soon as we got a signal, captain!
  Tracker.autorun((c) => {
    try { // May be an error if time is not synced
      UserStatus.startMonitor({
        threshold: 30000,
        idleOnBlur: true
      });
      return c.stop();
    } catch (error) {
      console.error(error);
    }
  });
}

if (Meteor.isServer) {
  // Try setting this so it works on meteor.com
  // (https://github.com/oortcloud/unofficial-meteor-faq)
  process.env.HTTP_FORWARDED_COUNT = 1;

  Meteor.publish(null, () => [
    Meteor.users.find({
      'status.online': true
    }, { // online users only
      fields: {
        status: 1,
        username: 1
      }
    }),
    UserStatus.connections.find()
  ]);
}
