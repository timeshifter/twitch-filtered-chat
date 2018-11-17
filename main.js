var default_colors = [
  '#0000FF',
  '#008000',
  '#FF0000',
  '#B22222',
  '#FF7F50',
  '#9ACD32',
  '#FF4500',
  '#2E8B57',
  '#DAA520',
  '#D2691E',
  '#5F9EA0',
  '#1E90FF',
  '#FF69B4',
  '#8A2BE2',
  '#00FF7F',
];

function GetRandomColor() {
  return default_colors[Math.floor(Math.random() * default_colors.length)];
}

var client, //twitch irc client
  queryList = {}, //query string params
  global_badges = {}, //all global badges
  channelTimerId = -1, //delay for changing channel text box
  channel_badges = {}, //all channel-specific badges
  user_undefined_colors = {}, //list of users with no defined color, to store a randomly chosen color
  message_history = [],
  message_history_length = 500,
  debug = true;
var _emoteReq,
  validEmotes = [],
  cheerLevels = [],
  valid_cheers = [];

var config = {
  Channel: '',
  Nick: '',
  Pass: '',
};

(function() {
  try {
    var confStr = localStorage.getItem('config');
    if (confStr) {
      config = JSON.parse(confStr);
      if (config) {
        txtChannel.value = config.Channel;
        txtNick.value = config.Nick;
        txtPass.value = config.Pass;
      }
    }
  } catch {}

  $('.module').each(function() {
    var id = $(this).attr('id');

    if (!config[id]) UpdateConfig($(this).attr('id'));
    else {
      $(this)
        .find('label.name')
        .html(config[id].Name);
      $(this)
        .find('input.name')
        .val(config[id].Name);
      if (config[id].Pleb)
        $(this)
          .find('input.pleb')
          .attr('checked', 'checked');
      else
        $(this)
          .find('input.pleb')
          .removeAttr('checked');

      if (config[id].Sub)
        $(this)
          .find('input.sub')
          .attr('checked', 'checked');
      else
        $(this)
          .find('input.sub')
          .removeAttr('checked');

      if (config[id].Mod)
        $(this)
          .find('input.mod')
          .attr('checked', 'checked');
      else
        $(this)
          .find('input.mod')
          .removeAttr('checked');

      if (config[id].Event)
        $(this)
          .find('input.event')
          .attr('checked', 'checked');
      else
        $(this)
          .find('input.event')
          .removeAttr('checked');

      if (config[id].Bits)
        $(this)
          .find('input.bits')
          .attr('checked', 'checked');
      else
        $(this)
          .find('input.bits')
          .removeAttr('checked');

      for (s of config[id].IncludeUser) {
        var li = `<li><label><input type="checkbox" value="${s}" class="include_user" checked />From user: ${s}</label></li>`;
        $(this)
          .find('li.include_user')
          .before(li);
      }

      for (s of config[id].IncludeKeyword) {
        var li = `<li><label><input type="checkbox" value="${s}" class="include_keyword" checked />Contains: ${s}</label></li>`;
        $(this)
          .find('li.include_keyword')
          .before(li);
      }

      for (s of config[id].ExcludeUser) {
        var li = `<li><label><input type="checkbox" value="${s}" class="exclude_user" checked />From user: ${s}</label></li>`;
        $(this)
          .find('li.exclude_user')
          .before(li);
      }

      for (s of config[id].ExcludeStartsWith) {
        var li = `<li><label><input type="checkbox" value="${s}" class="exclude_startswith" checked />Starts with: ${s}</label></li>`;
        $(this)
          .find('li.exclude_startswith')
          .before(li);
      }
    }
  });

  GetGlobalBadges();
  LoadCheerEmotes();

  //create queryList array
  if (window.location.search) {
    var query = window.location.search;
    var queryParts = query.substring(1).split('&');
    for (var i = 0; i < queryParts.length; i++) {
      var parts = queryParts[i].split('=');
      queryList[parts[0].trim()] = parts[1].trim();
    }
  }

  $('#txtChannel').on('input', function() {
    if (txtNick.value == '' || txtChannel.value.indexOf(txtNick.value) == 0)
      txtNick.value = txtChannel.value;
  });

  $('#settings')
    .on('input', 'input', UpdateChannelTimer)
    .keyup(function(e) {
      if (e.keyCode == 13) {
        $('#settings_button').click();
      }
    });

  $('#settings_button').click(function() {
    if ($('#settings').is(':visible')) $('#settings').fadeOut();
    else $('#settings').fadeIn();
  });

  $('.menu').click(function() {
    var $lbl = $(this)
        .parent()
        .children('label'),
      $tb = $(this)
        .parent()
        .children('input');

    if (
      $(this)
        .parent()
        .hasClass('open')
    ) {
      $(this)
        .parent()
        .removeClass('open');
      $lbl.html($tb.val());

      UpdateConfig(
        $(this)
          .closest('.module')
          .attr('id')
      );
    } else {
      $(this)
        .parent()
        .addClass('open');
      $tb.val($lbl.html());
    }
  });

  $('.module .settings input[type="text"]').on('keyup', function(e) {
    if (e.keyCode == 13) {
      var cls = $(this)
        .closest('li')
        .attr('class')
        .replace('textbox', '')
        .trim();
      var $li = $(
        `<li><label><input type="checkbox" value="${$(
          this
        ).val()}" class="${cls}" checked />${$(this)
          .closest('li')
          .find('label')
          .html()} ${$(this).val()}</label></li>`
      );
      $(this)
        .closest('li')
        .before($li);
      $(this).val('');
    }
  });

  $('#txtChat').on('keyup', function(e) {
    if (e.keyCode == 13) {
      client.SendMessage(txtChannel.value, txtChat.value);
      txtChat.value = '';
    }
  });

  InitClient();
})();

function UpdateChannelTimer() {
  clearTimeout(channelTimerId);
  channelTimerId = setTimeout(UpdateChannel, 500);
}

function UpdateChannel() {
  InitClient();
  //client.LeaveChannels(client.Channels[0]);

  config.Channel = txtChannel.value.toLowerCase();
  config.Nick = txtNick.value;
  config.Pass = txtPass.value;

  //client.JoinChannels(txtChannel.value.toLowerCase());
  localStorage.setItem('config', JSON.stringify(config));
}

function UpdateConfig(module) {
  var $module = $('#' + module);

  var o = {
    Name: $module.find('label.name').html(),
    Pleb: $module.find('input.pleb').is(':checked'),
    Sub: $module.find('input.sub').is(':checked'),
    Mod: $module.find('input.mod').is(':checked'),
    Event: $module.find('input.event').is(':checked'),
    Bits: $module.find('input.bits').is(':checked'),
    IncludeUser: [],
    IncludeKeyword: [],
    ExcludeUser: [],
    ExcludeStartsWith: [],
  };

  $module.find('input.include_user:checked').each(function() {
    o.IncludeUser.push($(this).val());
  });
  $module.find('input.include_keyword:checked').each(function() {
    o.IncludeKeyword.push($(this).val());
  });
  $module.find('input.exclude_user:checked').each(function() {
    o.ExcludeUser.push($(this).val());
  });
  $module.find('input.exclude_startswith:checked').each(function() {
    o.ExcludeStartsWith.push($(this).val());
  });
  config[module] = o;

  localStorage.setItem('config', JSON.stringify(config));
}

function InitClient() {
  client = null;
  if (txtNick.value.trim() != '' && txtPass.value.trim() != '') {
    //console.log('hi');
    client = new TwitchClient({
      Nick: txtNick.value,
      Pass: txtPass.value,
      Channels: txtChannel.value,
      Debug: debug,
    });
  } else {
    client = new TwitchClient({
      Channels: txtChannel.value,
      Debug: debug,
    });
  }

  client.onRoomstate = function(channel, settings) {
    //console.log(channel, settings['room-id']);
    GetChannelBadges(settings['room-id']);
  };

  client.onPrivmsg = function(user, channel, message, userData, rawMessage) {
    if (message_history[message_history.length - 1] == rawMessage) return;

    if (message_history.length == message_history_length)
      message_history.shift();

    message_history.push(rawMessage);

    var p = ParseMessage(user, message, userData);

    //go through each module and append the message
    //TODO: message filtering
    $('.module').each(function() {
      var id = $(this).attr('id');
      var $content = $(this).find('.content');

      var el = $content[0],
        scroll = false;

      if (el.clientHeight + el.scrollTop >= el.scrollHeight - 100)
        scroll = true;

      var disp = false;

      //plebs
      if (config[id].Pleb && !userData['subscriber']) disp = true;

      //subs
      if (config[id].Sub && userData['subscriber']) disp = true;

      //mods
      if (config[id].Mod && userData['mod']) disp = true;

      if (config[id].Bits && userData['bits']) disp = true;

      for (s of config[id].IncludeUser) {
        if (user.toLowerCase() == s.toLowerCase()) disp = true;
      }

      for (s of config[id].IncludeKeyword) {
        if (message.toLowerCase().indexOf(s.toLowerCase()) > -1) disp = true;
      }

      for (s of config[id].ExcludeUser) {
        if (user.toLowerCase() == s.toLowerCase()) disp = false;
      }

      for (s of config[id].ExcludeStartsWith) {
        if (message.toLowerCase().indexOf(s.toLowerCase()) == 0) disp = false;
      }

      if (disp) $content.append(p);

      if (scroll) el.scrollTop = el.scrollHeight;
    });
  };

  client.onUsernotice = function(message) {
    if (message_history.length == message_history_length)
      message_history.shift();

    message_history.push(message);

    //console.log(message);
  };
}

function ParseMessage(user, message, userData) {
  //use specified color if there is one; if not, pick a random one from the defaults and store it
  var user_col = userData['color'];
  if (user_col == '') {
    if (!user_undefined_colors[user]) {
      user_undefined_colors[user] = GetRandomColor();
    }

    user_col = user_undefined_colors[user];
  }

  var message_col = '';
  if (message.indexOf('ACTION') == 0) {
    message_col = `color: ${user_col}`;
    message = message.substring(8, message.length - 1);
  }

  message = message.replace(/</g, '&lt;').replace(/>/g, '&gt');

  //replace chat emote keywords with actual emote images
  if (userData.emotes != '') {
    var emoteParts = userData.emotes.split('/'),
      emoteList = [];

    for (var i in emoteParts) {
      var emoteId = emoteParts[i].split(':')[0],
        emoteStart,
        emoteEnd;
      var emoteLocations = emoteParts[i].split(':')[1].split(',');

      for (var l in emoteLocations) {
        emoteList.push({
          id: emoteId,
          start: parseInt(emoteLocations[l].split('-')[0], 10),
          end: parseInt(emoteLocations[l].split('-')[1], 10),
        });
      }
    }

    emoteList.sort((a, b) => b.start - a.start);

    for (var i in emoteList) {
      //console.log(i);
      message =
        message.substring(0, emoteList[i].start) +
        `<img src="https://static-cdn.jtvnw.net/emoticons/v1/${
          emoteList[i].id
        }/1.0" />` +
        message.substring(emoteList[i].end + 1);
    }
  }

  //get badges from channel list if it exists; if not, use global list
  var badge_text = '';
  if (userData['@badges'] != '') {
    var badges = userData['@badges'].split(',');

    for (i in badges) {
      if (channel_badges[badges[i]])
        badge_text += `<img src="${channel_badges[badges[i]]}" />`;
      else badge_text += `<img src="${global_badges[badges[i]]}" />`;
    }
    badge_text = '<span class="badges">' + badge_text + '</span>';
  }

  //bit parsing
  if (userData.bits) {
    var cheerTest = /^([a-z]+)(\d+)$/;

    var msgWords = message.toLowerCase().split(' '),
      msg_out = '';

    for (i in msgWords) {
      if (cheerTest.test(msgWords[i])) {
        var cheerResult = cheerTest.exec(msgWords[i]);

        var prefix = '';

        for (c_i in valid_cheers) {
          if (c_i == cheerResult[1]) {
            prefix = c_i;
            break;
          }
        }

        if (prefix != '') {
          var tier = 0,
            col = '';

          for (j of valid_cheers[prefix]) {
            if (cheerResult[2] >= j.bits) {
              tier = j.bits;
              col = j.color;
            } else {
              break;
            }
          }
          msg_out += `<span style="color:${col};font-weight:bold;"><img src="https://d3aqoihi2n8ty8.cloudfront.net/actions/${prefix}/dark/animated/${tier}/1.gif" /> ${
            cheerResult[2]
          }</span> `;
        } else {
          msg_out += msgWords[i] + ' ';
        }
      } else {
        msg_out += msgWords[i] + ' ';
      }
    }
    message = msg_out;
  }

  //link parsing
  message = message + ' ';

  var startIdx = 0,
    endIdx = 0;

  while (startIdx > -1 && startIdx < message.length - 1) {
    endIdx = message.indexOf(' ', startIdx + 1);

    var word = message.substring(startIdx, endIdx).trim();

    if (
      word.toLowerCase().indexOf('www') == 0 ||
      word.toLowerCase().indexOf('http://') == 0 ||
      word.toLowerCase().indexOf('https://') == 0
    ) {
      var s = `<a target="_blank" href="${(word.toLowerCase().indexOf('http') !=
      0
        ? 'https://'
        : '') + word}">${word}</a>`;
      message =
        message.substring(0, startIdx) + ' ' + s + message.substring(endIdx);
    }

    startIdx = message.indexOf(' ', startIdx + 1);
  }

  message = message.trim();

  //create the message html
  var p = `<p>${badge_text} <span class="username" style="color: ${user_col}">${
    userData['display-name']
  }</span>${
    message_col == '' ? ':' : ''
  } <span style="${message_col}">${message}</span>`;

  return p;
}

function GetChannelBadges(channelId) {
  var badge_req = new XMLHttpRequest();

  badge_req.onreadystatechange = function() {
    if (this.readyState == 4 && this.status === 200) {
      var json = JSON.parse(this.responseText);

      if (json.badge_sets.bits) {
        for (b in json.badge_sets.bits.versions) {
          channel_badges[`bits/${b}`] =
            json.badge_sets.bits.versions[b]['image_url_1x'];
        }
      }

      if (json.badge_sets.subscriber) {
        for (s in json.badge_sets.subscriber.versions) {
          channel_badges[`subscriber/${s}`] =
            json.badge_sets.subscriber.versions[s]['image_url_1x'];
        }
      }
    }
  };

  badge_req.open(
    'GET',
    `https://badges.twitch.tv/v1/badges/channels/${channelId}/display`
  );
  badge_req.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
  badge_req.send();
}

function GetGlobalBadges() {
  var global_req = new XMLHttpRequest();

  global_req.onreadystatechange = function() {
    if (this.readyState == 4 && this.status === 200) {
      var json = JSON.parse(this.responseText);
      for (s in json.badge_sets) {
        for (v in json.badge_sets[s].versions) {
          global_badges[s + '/' + v] =
            json.badge_sets[s].versions[v]['image_url_1x'];
        }
      }
    }
  };

  global_req.open('GET', 'https://badges.twitch.tv/v1/badges/global/display');
  global_req.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
  global_req.send();
}

var raw_cheer;

function LoadCheerEmotes() {
  _emoteReq = new XMLHttpRequest();

  _emoteReq.onreadystatechange = function() {
    if (this.readyState == 4 && this.status === 200) {
      var json = JSON.parse(this.responseText);

      raw_cheer = json;

      validEmotes = [];
      cheerLevels = [];

      for (i in json.actions) {
        valid_cheers[json.actions[i].prefix.toLowerCase()] = [];
        for (t in json.actions[i].tiers) {
          valid_cheers[json.actions[i].prefix.toLowerCase()].push({
            bits: json.actions[i].tiers[t].min_bits,
            color: json.actions[i].tiers[t].color,
          });
        }
      }

      //for (i in json.actions[0].tiers) {
      //    cheerLevels.push(json.actions[0].tiers[i].min_bits);
      //}
    }
  };

  _emoteReq.open('GET', 'https://api.twitch.tv/kraken/bits/actions');
  _emoteReq.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
  _emoteReq.setRequestHeader('Client-ID', 'dcirpjuzebyjmxvjyj30x6pybo8nx9');
  _emoteReq.send();
}
