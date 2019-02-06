
var TW_URL = {}
TW_URL.ChannelBadges = (cid) =>
    `https://badges.twitch.tv/v1/badges/channels/${cid}/display`;
TW_URL.GlobalBadges = () => `https://badges.twitch.tv/v1/badges/global/display`;
TW_URL.CheerEmotes = () => `https://api.twitch.tv/kraken/bits/actions`;
TW_URL.Emote = (id) => `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`;
TW_URL.Cheer = (p, t) =>
    `https://d3aqoihi2n8ty8.cloudfront.net/actions/${p}/dark/animated/${t}/1.gif`;

function LoadChannelBadges(channelId, callback) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status === 200) {
            var json = JSON.parse(this.responseText);
            callback(json);
        }
    };
    req.open("GET", TW_URL.ChannelBadges(channelId));
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    req.send();
}

function LoadGlobalBadges(callback) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status === 200) {
            var json = JSON.parse(this.responseText);
            callback(json);
        }
    };
    req.open("GET", TW_URL.GlobalBadges());
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    req.send();
}

function LoadCheerEmotes(clientId, callback) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status === 200) {
            var json = JSON.parse(this.responseText);
            callback(json);
        }
    };
    req.open("GET", TW_URL.CheerEmotes());
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    req.setRequestHeader("Client-ID", clientId);
    req.send();
}

