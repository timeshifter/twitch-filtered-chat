// Twitch Filtered Chat
// Primary Object

/* Configuration object
 * "Superusers": list of users who have access to do Bad Things (tm)
 * "Nick": username for the filtered chat
 * "Pass": password (oauth) for the filtered chat
 * "Channels": list of channels to join
 * "HistorySize": max scrollback
 * "Debug": enable debugging
 */

function FilteredChat(config) {
  this.config = config;
  this.client = null;

  this.superusers = {'Kaedenn_': 1};
  this.global_badges = {};
  this.channel_badges = {};
  this.user_colors = {};
  this.valid_emotes = [];
  this.valid_cheers = [];
  this.cheer_levels = [];
  this.history = [];
  this.history_size = config.HistorySize || 500;
  this.debug = !!config.Debug;

  if (config.Superusers) {
    for (var user in config.Superusers) {
      this.superusers[user] = 1;
    }
  }

  var nick = this.config.Nick;
  var pass = this.config.Pass;
  var channels = this.config.Channels;
  var debug = !!this.config.Debug;

  // Prevent snooping
  this.config.Nick = undefined;
  this.config.Pass = undefined;

  // Load the badges, cheer emotes, etc
  this._loadAssets();

  // Construct the client and connect to Twitch
  if (nick.trim() != '' && pass.trim() != '') {
    this.client = new TwitchClient({
      Nick: nick,
      Pass: pass,
      Channels: channels,
      Debug: debug
    });
  } else {
    this.client = new TwitchClient({
      Channels: channels,
      Debug: debug
    });
  }

  // Room information
  this.rooms = {}
}

FilteredChat.prototype._loadAssets = function() {
  var self = this;
  function cb_loadGlobalBadges(json) {
    for (s in json.badge_sets) {
      for (v in json.badge_sets[s].versions) {
        var key = s + "/" + v
        self.global_badges[key] = json.badge_sets[s].versions[v]["image_url_1x"];
      }
    }
  }
  function cb_loadCheerEmotes(json) {
    for (i in json.actions) {
      var p = json.actions[i].prefix.toLowerCase();
      self.valid_cheers[p] = [];
      for (t in json.actions[i].tiers) {
        self.valid_cheers[p].push({
          bits: json.actions[i].tiers[t].min_bits,
          color: json.actions[i].tiers[t].color
        });
      }
    }
  }
  LoadGlobalBadges(cb_loadGlobalBadges);
  LoadCheerEmotes(cb_loadCheerEmotes);
}

FilteredChat.prototype.onRoomstate = function(channel, settings) {
  var self = this;
  function cb_loadChannelBadges(json) {
    if (json.badge_sets.bits) {
      for (b in json.badge_sets.bits.versions) {
        var version = json.badge_sets.bits.versions[b];
        self.channel_badges[`bits/${b}`] = version["image_url_1x"];
      }
    }
    if (json.badge_sets.subscriber) {
      for (b in json.badge_sets.subscriber.versions) {
        var version = json.badge_sets.subscriber.versions[b];
        self.channel_badges[`subscriber/${b}`] = version["image_url_1x"];
      }
    }
  }
  LoadChannelBadges(settings["room-id"], cb_loadChannelBadges);

  // Store room settings
  this.rooms[channel].emote_only = settings['emote-only'];
  this.rooms[channel].followers_only = settings['followers-only'];
  this.rooms[channel].subs_only = settings['subs-only'];
  this.rooms[channel].r9k = settings['r9k'];
  this.rooms[channel].rituals = settings['riturals'];
  this.rooms[channel].id = settings['room-id'];
  this.rooms[channel].slow = settings['slow'];
  this.rooms[channel].name = channel;
}

FilteredChat.prototype.onPrivmsg = function(user, channel, message, userData, rawMessage) {
}

FilteredChat.prototype.onUsernotice = function(message) {
  if (this.history.length == this.history_size) {
    this.history.shift();
  }
  this.history.push(message);
}

FilteredChat.prototype.onJoin = function(user, channel) {
  /* user ${user} joined the channel ${channel} */
}

FilteredChat.prototype.onPart = function(user, channel) {
  /* user ${user} left the channel ${channel} */
}

FilteredChat.prototype.onMessage = function(line) {
  /* received raw message ${line} */
}

FilteredChat.prototype.onSub = function(line) {
  console.log('onSub', line);
}

FilteredChat.prototype.onReSub = function(line) {
  console.log('onReSub', line);
}

FilteredChat.prototype.onGiftSub = function(line) {
  console.log('onGiftSub', line);
}

// vim:ts=2:sts=2:sw=2:et
