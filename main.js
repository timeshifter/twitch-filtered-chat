
/* Hijacking fixes:
 *
 * HTML injection: escape "<", ">", "\"", "'", "&"
 * URL attribute injection: via escaped "\""
    www"style="position:fixed;bottom:0;left:0;top:0;right:0;opacity:1;background:#FFF;"onmouseover="window.location='https://www.twitch.tv/dwangoac';
 *
 */

/* TODO: markdown
 * https://github.com/showdownjs/showdown
 */

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
    '#00FF7F'
];

function GetRandomColor() {
    return default_colors[Math.floor(Math.random() * default_colors.length)];
}

var EscapeCharsList = ['&', '"', "'", '<', '>'];
var EscapeChars = {
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
    '<': '&lt;',
    '>': '&gt;'
};

function EscapeString(s) {
    for (var e of EscapeCharsList) {
        s = s.replace(e, EscapeChars[e]);
    }
    return s;
}

var client //twitch irc client
    , queryList = {} //query string params
    , global_badges = {} //all global badges
    , channelTimerId = -1 //delay for changing channel text box
    , channel_badges = {} //all channel-specific badges
    , user_undefined_colors = {} //list of users with no defined color, to store a randomly chosen color
    , message_history = []
    , message_history_length = 500
    , debug=true
    ;

var _emoteReq,
    validEmotes = [],
    cheerLevels = [],
    valid_cheers = [];

/* Users allowed to use "force" */
var super_users = {
    Kaedenn_: 1,
    MediaMagnet: 1,
    dwangoAC: 1
};

var config = {
    Channel: '',
    Nick: '',
    Pass: ''
};

/* Known style keywords and their cost */
var valid_styles = {
    marquee: {cost: 1, value: ['<marquee>', '</marquee>']},
    bold: {cost: 1, value: ['<b>', '</b>']},
    italic: {cost: 1, value: ['<i>', '</i>']},
    underline: {cost: 1, value: ['<span style="text-decoration: underline;">', '</span>']},
    upsidedown: {cost: 1, value: ['<span style="display:block; transform: rotate(180deg); text-align: right;">', '</span>']},
    inverted: {cost: 1, value: ['<span style="filter: invert(100%);">', '</span>']},
    strikethrough: {cost: 1, value: ['<span style="text-decoration: line-through;">', '</span>']},
    subscript: {cost: 1, value: ['<sub>', '</sub>']},
    superscript: {cost: 1, value: ['<sup>', '</sup>']}
};

(function () {
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
    }
    catch{}

    $('.module').each(function () {
        var id = $(this).attr('id');

        if (!config[id])
            UpdateConfig($(this).attr('id'));
        else {
            $(this).find('label.name').html(config[id].Name);
            $(this).find('input.name').val(config[id].Name);
            if (config[id].Pleb)
                $(this).find('input.pleb').attr('checked', 'checked');
            else
                $(this).find('input.pleb').removeAttr('checked');

            if (config[id].Sub)
                $(this).find('input.sub').attr('checked', 'checked');
            else
                $(this).find('input.sub').removeAttr('checked');

            if (config[id].Mod)
                $(this).find('input.mod').attr('checked', 'checked');
            else
                $(this).find('input.mod').removeAttr('checked');

            if (config[id].Event)
                $(this).find('input.event').attr('checked', 'checked');
            else
                $(this).find('input.event').removeAttr('checked');

            if (config[id].Bits)
                $(this).find('input.bits').attr('checked', 'checked');
            else
                $(this).find('input.bits').removeAttr('checked');

            for (s of config[id].IncludeUser) {
                var li = `<li><label><input type="checkbox" value="${s}" class="include_user" checked />From user: ${s}</label></li>`
                $(this).find('li.include_user').before(li);
            }

            for (s of config[id].IncludeKeyword) {
                var li = `<li><label><input type="checkbox" value="${s}" class="include_keyword" checked />Contains: ${s}</label></li>`
                $(this).find('li.include_keyword').before(li);
            }

            for (s of config[id].ExcludeUser) {
                var li = `<li><label><input type="checkbox" value="${s}" class="exclude_user" checked />From user: ${s}</label></li>`
                $(this).find('li.exclude_user').before(li);
            }

            for (s of config[id].ExcludeStartsWith) {
                var li = `<li><label><input type="checkbox" value="${s}" class="exclude_startswith" checked />Starts with: ${s}</label></li>`
                $(this).find('li.exclude_startswith').before(li);
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

    $('#txtChannel').on('input', function () {
        if (txtNick.value == '' || txtChannel.value.indexOf(txtNick.value) == 0)
            txtNick.value = txtChannel.value;
    });

    $('#settings').on('input', 'input', UpdateChannelTimer)
        .keyup(function (e) {
            if (e.keyCode == 13) {
                $('#settings_button').click();
            }
        })

    $('#settings_button').click(function () {
        if ($('#settings').is(':visible'))
            $('#settings').fadeOut();
        else
            $('#settings').fadeIn();
    });

    $('.menu').click(function () {
        var $lbl = $(this).parent().children('label'),
            $tb = $(this).parent().children('input');
        if ($(this).parent().hasClass('open')) {
            $(this).parent().removeClass('open');
            $lbl.html($tb.val());
            UpdateConfig($(this).closest('.module').attr('id'));
        } else {
            $(this).parent().addClass('open');
            $tb.val($lbl.html());
        }
    });

    $('.module .settings input[type="text"]').on('keyup', function (e) {
        if (e.keyCode == 13) {
            var cls = $(this).closest('li').attr('class').replace('textbox', '').trim();
            var $li = $(`<li><label><input type="checkbox" value="${$(this).val()}" class="${cls}" checked />${$(this).closest('li').find('label').html()} ${$(this).val()}</label></li>`);
            $(this).closest('li').before($li);
            $(this).val('');
        }
    });

    $('#txtChat').on('keyup', function (e) {
        if (e.keyCode == 13) {
            client.SendMessage(txtChannel.value, txtChat.value);
            txtChat.value = '';
        }
    })

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
        ExcludeStartsWith: []
    };

    $module.find('input.include_user:checked').each(function () {
        o.IncludeUser.push($(this).val());
    });
    $module.find('input.include_keyword:checked').each(function () {
        o.IncludeKeyword.push($(this).val());
    });
    $module.find('input.exclude_user:checked').each(function () {
        o.ExcludeUser.push($(this).val());
    });
    $module.find('input.exclude_startswith:checked').each(function () {
        o.ExcludeStartsWith.push($(this).val());
    });
    config[module] = o;

    localStorage.setItem('config', JSON.stringify(config));
}

function InitClient() {
    client = null;
    if (txtNick.value.trim() != '' && txtPass.value.trim() != '') {
        client = new TwitchClient({
            Nick: txtNick.value,
            Pass: txtPass.value,
            Channels: txtChannel.value,
            Debug: debug
        });
    } else {
        client = new TwitchClient({
            Channels: txtChannel.value,
            Debug: debug
        });
    }

    client.onRoomstate = function (channel, settings) {
        console.log('Joined channel', channel, settings['room-id']);
        GetChannelBadges(settings['room-id']);
    };

    client.onPrivmsg = function (user, channel, message, userData, rawMessage) {
        if (message_history[message_history.length - 1] == rawMessage)
            return;

        if (message_history.length == message_history_length)
            message_history.shift();

        message_history.push(rawMessage);

        var p = ParseMessage(user, message, userData);

        //go through each module and append the message
        //TODO: message filtering
        $('.module').each(function () {
            var id = $(this).attr('id');
            var $content = $(this).find('.content');

            var el = $content[0],
                scroll = false;

            if (el.clientHeight + el.scrollTop >= el.scrollHeight - 100)
                scroll = true;

            var disp = false;

            //plebs
            if (config[id].Pleb && !userData['subscriber'])
                disp = true;

            //subs
            if (config[id].Sub && userData['subscriber'])
                disp = true;

            //mods
            if (config[id].Mod && userData['mod'])
                disp = true;

            if (config[id].Bits && userData['bits'])
                disp = true;

            for (s of config[id].IncludeUser) {
                if (user.toLowerCase() == s.toLowerCase())
                    disp = true;
            }

            for (s of config[id].IncludeKeyword) {
                if (message.toLowerCase().indexOf(s.toLowerCase()) > -1)
                    disp = true;
            }

            for (s of config[id].ExcludeUser) {
                if (user.toLowerCase() == s.toLowerCase())
                    disp = false;
            }

            for (s of config[id].ExcludeStartsWith) {
                if (message.toLowerCase().indexOf(s.toLowerCase()) == 0)
                    disp = false;
            }

            if (disp)
                $content.append(p);

            if (scroll)
                el.scrollTop = el.scrollHeight;
        });

    };

    client.onUsernotice = function (message) {
        if (message_history.length == message_history_length)
            message_history.shift();
        message_history.push(message);
    };

    function _build_callback(name) {
        return function() {
            console.log(name, arguments);
        };
    }

    // onJoin(user, channel)
    client.onJoin = _build_callback('client.onJoin');
    // onPart(user, channel)
    client.onPart = _build_callback('client.onPart');
    // onMessage(line)
    client.onMessage = _build_callback('client.onMessage');

    // TODO: remove
    window.client = client;
}

function ParseEmotes(userData, message, force_start, noesc) {
    // Allow an override "string does not start at zero" for prefix removal
    if (force_start === undefined) { force_start = 0; }
    // Bypass escaping logic if needed
    if (noesc === undefined) { noesc = false; }

    // Calculate offset adjustments based on escaping
    var adjusted = [];
    var adjustment = 0;
    for (var i = 0; i < message.length; ++i) {
        if (message[i] in EscapeChars && !noesc) {
            adjustment += EscapeChars[message[i]].length - message[i].length;
        }
        adjusted.push(i + adjustment);
    }

    // Parse the emotes, taking into account any adjustments
    var emoteParts = userData.emotes.split('/'),
        emoteList = [];
    for (var i in emoteParts) {
        var emoteId = emoteParts[i].split(':')[0];
        var emoteLocations = emoteParts[i].split(':')[1].split(',');
        for (var l in emoteLocations) {
            var start = parseInt(emoteLocations[l].split('-')[0], 10);
            var end = parseInt(emoteLocations[l].split('-')[1], 10);
            emoteList.push({
                id: emoteId,
                img: `<img src="https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0" />`,
                start: adjusted[start] - force_start,
                end: adjusted[end] - force_start
            });
        }
    }

    // Sort for in-place string replacing later
    emoteList.sort((a, b) => b.start - a.start);

    return emoteList;
}

function ParseMessage(user, message, userData) {
    if (debug) {
        console.log('ParseMessage():');
        console.log(user);
        console.log(message)
        console.log(userData);
    }

    // Use specified color if there is one; if not, pick a random one from the
    // defaults and store it
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

    var message_pre = '';
    var message_post = '';

    // Allow super-users to bypass escaping
    var noesc = false;
    if (userData["display-name"] in super_users) {
        if (message.split(' ')[0] == 'force') {
            noesc = true;
        }
    }

    // Parse emotes before escaping string
    var emoteList = [];
    if (userData.emotes != "") {
        emoteList = ParseEmotes(userData, message, 0, noesc);
    }

    // Actually escape the string
    if (!noesc) {
        message = EscapeString(message);
    }

    // replace chat emote keywords with actual emote images
    if (userData.emotes != "") {
        for (var i in emoteList) {
            message = message.substring(0, emoteList[i].start)
                + emoteList[i].img
                + message.substring(emoteList[i].end + 1);
        }
    }

    // get badges from channel list if it exists; if not, use global list
    var badge_text = '';
    if (userData['@badges'] != "") {
        var badges = userData["@badges"].split(',');
        for (i in badges) {
            if (channel_badges[badges[i]])
                badge_text += `<img src="${channel_badges[badges[i]]}" />`;
            else
                badge_text += `<img src="${global_badges[badges[i]]}" />`;
        }
        badge_text = '<span class="badges">' + badge_text + '</span>';
    }

    // bit parsing
    if (userData.bits) {
        var bitsLeft = userData.bits;
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
                    // handle custom cheer formatting commands
                    var wi = parseInt(i) + 1;
                    while (wi < msgWords.length) {
                        var sdef;
                        if (msgWords[wi] in valid_styles) {
                            sdef = valid_styles[msgWords[wi]];
                        } else if (msgWords[wi] in colors) {
                            // hard-coded: colors cost 1 bit
                            sdef = {cost: 1, value: [`<span style="color:${colors[msgWords[wi]]};">`, `</span>`]};
                        } else {
                            break;
                        }
                        if (sdef.cost <= bitsLeft) {
                            // can afford
                            message_pre = message_pre + sdef.value[0];
                            message_post = sdef.value[1] + message_post;
                            bitsLeft -= sdef.cost;
                        } else {
                            break;
                        }
                        wi += 1;
                    }
                    msg_out += `<span style="color:${col};font-weight:bold;"><img src="https://d3aqoihi2n8ty8.cloudfront.net/actions/${prefix}/dark/animated/${tier}/1.gif" /> ${cheerResult[2]}</span> `
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
    var startIdx = 0, endIdx = 0;
    while (startIdx > -1 && startIdx < (message.length - 1)) {
        endIdx = message.indexOf(' ', startIdx + 1);
        var word = message.substring(startIdx, endIdx).trim();
        var word_l = word.toLowerCase();
        if (word_l.indexOf('www') == 0 || word_l.indexOf('http://') == 0 || word_l.indexOf('https://') == 0) {
            var scheme = word_l.indexOf('http') != 0 ? 'https://' : '';
            var href = scheme + word;
            var text = word;
            var s = `<a target="_blank" href="${href}">${text}</a>`;
            message = message.substring(0, startIdx) + ' ' + s + message.substring(endIdx);
        }
        startIdx = message.indexOf(' ', startIdx + 1);
    }
    message = message.trim();

    //create the message html
    var p = `<p>${badge_text} <span class="username" style="color: ${user_col}">${userData["display-name"]}</span>${message_col == '' ? ":" : ""} <span style="${message_col}">${message_pre}${message}${message_post}</span>`;

    return p;
}

function GetChannelBadges(channelId) {
    var badge_req = new XMLHttpRequest();
    badge_req.onreadystatechange = function () {
        if (this.readyState == 4 && this.status === 200) {
            var json = JSON.parse(this.responseText);
            if (json.badge_sets.bits) {
                for (b in json.badge_sets.bits.versions) {
                    channel_badges[`bits/${b}`] = json.badge_sets.bits.versions[b]["image_url_1x"];
                }
            }
            if (json.badge_sets.subscriber) {
                for (s in json.badge_sets.subscriber.versions) {
                    channel_badges[`subscriber/${s}`] = json.badge_sets.subscriber.versions[s]["image_url_1x"];
                }
            }
        }
    }
    badge_req.open('GET', `https://badges.twitch.tv/v1/badges/channels/${channelId}/display`);
    badge_req.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
    badge_req.send();
}

function GetGlobalBadges() {
    var global_req = new XMLHttpRequest();
    global_req.onreadystatechange = function () {
        if (this.readyState == 4 && this.status === 200) {
            var json = JSON.parse(this.responseText);
            for (s in json.badge_sets) {
                for (v in json.badge_sets[s].versions) {
                    global_badges[s + '/' + v] = json.badge_sets[s].versions[v]["image_url_1x"];
                }
            }
        }
    }
    global_req.open('GET', 'https://badges.twitch.tv/v1/badges/global/display');
    global_req.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
    global_req.send();
}

var raw_cheer;

function LoadCheerEmotes() {
    _emoteReq = new XMLHttpRequest();
    _emoteReq.onreadystatechange = function () {
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
                        color: json.actions[i].tiers[t].color
                    });
                }
            }
            //for (i in json.actions[0].tiers) {
            //    cheerLevels.push(json.actions[0].tiers[i].min_bits);
            //}
        }
    }
    _emoteReq.open('GET', 'https://api.twitch.tv/kraken/bits/actions');
    _emoteReq.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
    _emoteReq.setRequestHeader('Client-ID', 'dcirpjuzebyjmxvjyj30x6pybo8nx9');
    _emoteReq.send();
}

// vim:ts=4:sts=4:sw=4:et
