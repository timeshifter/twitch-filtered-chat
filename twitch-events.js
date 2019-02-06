
/*
opts =
{
    ClientID: 'foo',
    Nick: 'botshifter08',
    Pass: 'oauth:abcde12345',
    Debug: false,
    onConnect: f()
}
*/
function TwitchClient(opts) {

    //privates
    var _ws,
        _clientId = opts.ClientID,
        _nick,
        client = this,
        _defaultEventsHandled = {},
        _channelIds = {},
        _channelNames = {},
        _channelRooms = {};

    //publics
    this.Debug = opts.Debug || false;
    this.Channels = [];
    this.PendingChannels = [];

    if (opts.Channels) {
        if (Array.isArray(opts.Channels))
            this.PendingChannels = opts.Channels;
        else
            this.PendingChannels.push(opts.Channels);
    }

    if (_clientId == undefined && this.Debug) {
        console.log('ClientID not provided; follower data will not be available.');
    }
    else {
        this.ClientID = _clientId;
    }

    //websocket handlers
    function OnWebsocketOpen() {
        this.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
        if (opts.Nick && opts.Pass) {
            this.send(`PASS ${(opts.Pass.indexOf('oauth:') == 0 ? '' : 'oauth:')} ${opts.Pass}`);
            this.send(`NICK ${opts.Nick}`);
            this.Nickname = opts.Nick;
        }
        else {
            this.send(`NICK justinfan${Math.floor(Math.random() * 999999)}`);
        }

        var idx=0;
        while (idx < client.PendingChannels.length) {
            if (client.PendingChannels[idx].indexOf(':') == -1) {
                var c = client.PendingChannels[idx].trim();
                if (c.indexOf('#') != 0)
                    c = '#' + c;
                this.send(`JOIN ${c}`);
                client.Channels.push(c);
                client.PendingChannels.shift();
            }
            else {
                idx++
            }
        }
    }

    function OnWebsocketMessage(msgData) {
        var data = msgData.data.split('\r\n');

        for (line of data) {

            if (line.trim() == '') {
                continue;
            }

            if (client.Debug) {
                console.log('ws>', msgData);
            }

            if (client.onMessage)
                client.onMessage(line);

            var parts = line.split(' ');

            if (parts[0] == 'PING') {
                _ws.send(`PONG ${parts[1].substring(1)}`);
            }
            else if (parts[1] == 'JOIN') {
                if (client.onJoin)
                    client.onJoin(parts[0].split(':')[1].split('!')[0], parts[2]);
            }
            else if (parts[1] == 'PART') {
                if (client.onPart)
                    client.onPart(parts[0].split(':')[1].split('!')[0], parts[2]);
            }
            else if (parts[1] == 'MODE') {
                if (client.onMode)
                    client.onMode(line);
            }
            else if (parts[2] == 'PRIVMSG') {
/*
@badges=broadcaster/1;color=#1E90FF;display-name=timeshifter08;emotes=;id=d653a0d0-1cd0-492e-ad6e-2de1940a8d16;mod=0;room-id=61927669;subscriber=0;tmi-sent-ts=1524771643982;turbo=0;user-id=61927669;user-type=
 :timeshifter08!timeshifter08@timeshifter08.tmi.twitch.tv PRIVMSG #timeshifter08 :asdf

@badges=broadcaster/1;color=#1E90FF;display-name=timeshifter08;emotes=;id=847906fc-5db5-4ce5-9258-f206b94d9a31;mod=0;room-id=61927669;subscriber=0;tmi-sent-ts=1524771400844;turbo=0;user-id=61927669;user-type=
 :timeshifter08!timeshifter08@timeshifter08.tmi.twitch.tv PRIVMSG #chatrooms:61927669:a0c1e70d-7d52-491a-bcd5-6db6a5492d64 :asdf
*/
                var userdata = parts[0].split(';');

                var userdata_obj = {};

                for (s of userdata) {
                    var sides = s.split('=');
                    userdata_obj[sides[0]] = sides[1];
                }

                var user = parts[1].split(':')[1].split('!')[0],
                    channel = parts[3];

                var idx = line.indexOf(':', line.indexOf(channel));
                var msg = line.substring(idx + 1);

                if (client.onPrivmsg)
                    client.onPrivmsg(user, channel.substring(1), msg, userdata_obj, line);

            }
            else if (parts[2] == 'ROOMSTATE') {
                /*
@broadcaster-lang=;emote-only=0;followers-only=-1;r9k=0;rituals=1;room-id=61927669;slow=0;subs-only=0 :tmi.twitch.tv ROOMSTATE #timeshifter08

@badges=broadcaster/1;color=#1E90FF;display-name=timeshifter08;emotes=;id=377f9462-5f5e-4e5a-a3c5-13911dc7a623;mod=0;room-id=61927669;subscriber=0;tmi-sent-ts=1525115130064;turbo=0;user-id=61927669;user-type= :timeshifter08!timeshifter08@timeshifter08.tmi.twitch.tv PRIVMSG
 #chatrooms:61927669:a0c1e70d-7d52-491a-bcd5-6db6a5492d64 :alooooha
                */

                var userdata = parts[0].split(';');

                var userdata_obj = {};

                for (s of userdata) {
                    var sides = s.split('=');
                    userdata_obj[sides[0]] = sides[1];
                }

                var channel = line.split(' ')[3].substring(1).trim().toLowerCase();

                if (client.onRoomstate)
                    client.onRoomstate(channel, userdata_obj);

            }
            else if (parts[2] == 'USERNOTICE') {
                client.onUsernotice(line);
                if (!window.userNotices) { window.userNotices = []; }
                window.userNotices.push(line);
                var msgParts = parts[0].split(';');
                var isSub = 0;
                for (var i = 0; i < msgParts.length; i++) {
                    if (msgParts[i] == 'msg-id=sub') {
                        isSub = 1;
                        break;
                    } else if (msgParts[i] == 'msg-id=resub') {
                        isSub = 2;
                        break;
                    } else if (msgParts[i] == 'msg-id=subgift') {
                        isSub = 3;
                        break;
                    }
                }
                switch (isSub) {
                    case 1: /* first sub */
                        if (client.onSub)
                            client.onSub(line);
                        break;
                    case 2: /* resub */
                        if (client.onReSub)
                            client.onReSub(line);
                        break;
                    case 3: /* sub gift */
                        if (client.onSubGift)
                            client.onSubGift(line);
                        break;
                }
            }
        }
    }

    function OnWebsocketError(e) {
        if (client.Debug) {
            console.log(`Websocket error: ${e}`);
        }
        setTimeout(function () {
            client.Connect();
        }, 1000);
    }

    function OnWebsocketClose(e) {
        setTimeout(function () {
            client.Connect();
        }, 1000);
    }

    //public functions

    this.Connect = function () {

        for (c of client.Channels) {
            client.PendingChannels.push(c);
        }
        client.Channels = [];

        _ws = new WebSocket('wss://irc-ws.chat.twitch.tv');
        _ws.onopen = OnWebsocketOpen;
        _ws.onmessage = OnWebsocketMessage;
        _ws.onerror = OnWebsocketError;
        _ws.onclose = OnWebsocketClose;
        if (client.Debug) {
            client._ws = _ws;
        }

    }

    ///Send a message to the specified channel
    this.SendMessage = function (channel, message) {
        if (channel.indexOf('#') != 0)
            channel = '#' + channel;

        _ws.send(`PRIVMSG ${channel} :${message}`);
    }

    ///Join a single channel or an array of channel names
    this.JoinChannels = function (channels) {
        var arr = [];
        if (!Array.isArray(channels)) {
            arr.push(channels);
        }
        else {
            arr = channels;
        }

        for (c of arr) {
            c = c.trim().toLowerCase();

            //if (c.split(':').length == 3) {
            //    throw 'Error: Chat rooms must be joined by <channel name>:<room name>.'
            //    return;
            //}
            //else if (c.split(':').length == 2) {

            //}

            if (c[0] != '#')
                c = '#' + c;

            if (_ws.readyState == 1) {
                client.Channels.push(c);

                _ws.send(`JOIN ${c}`);
            }
            else
                client.PendingChannels.push(c);

        }
    }

    ///Leave a single channel or an array of channel names
    this.LeaveChannels = function (channels) {
        var arr = [];
        if (!Array.isArray(channels)) {
            arr.push(channels);
        }
        else {
            arr = channels;
        }

        for (c of arr) {
            if (c != undefined) {
                c = c.trim().toLowerCase();
                if (c[0] != '#')
                    c = '#' + c;

                if (_ws.readyState == 1) {

                    _ws.send(`PART ${c}`);
                    var i = client.Channels.indexOf(c);
                    client.Channels.splice(i, 1);
                }
                else {
                    var i = client.PendingChannels.indexOf(c);
                    client.PendingChannels.splice(i, 1);

                }
            }
        }
    }

    //events

    function SetDefaultEventHandled(evt) {
        if (!_defaultEventsHandled[evt]) {
            console.log(`${evt} event not handled!`);
            _defaultEventsHandled[evt] = true;
        }
    }

    this.onMessage = function (message) {
        SetDefaultEventHandled('onMessage');
    }

    this.onPrivmsg = function (user, channel, message, userData, rawMessage) {
        SetDefaultEventHandled('onPrivmsg');
    }

    this.onJoin = function (user, channel) {
        SetDefaultEventHandled('onJoin');
    }

    this.onPart = function (user, channel) {
        SetDefaultEventHandled('onPart');
    }

    this.onRoomstate = function (channel, settings) {
        SetDefaultEventHandled('onRoomstate');
    }

    this.onUsernotice = function (message) {
        SetDefaultEventHandled('onUsernotice');
    }

    ///gooooo!
    this.Connect();

    this.DebugFunction = function () {
        console.log('channel id list:   ', _channelIds);
        console.log('channel name list: ', _channelNames);
    }
}
