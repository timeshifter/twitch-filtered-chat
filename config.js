// Twitch Filtered Chat
// Configuration

// All user-configurable items should be included in this file

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
    superscript: {cost: 1, value: ['<sup>', '</sup>']},
    big: {cost: 1, value: ['<span style="font-size: larger">', '</span>']},
    small: {cost: 1, value: ['<span style="font-size: smaller">', '</span>']}
};

/* Users allowed to use "force" */
var super_users = {
    Kaedenn_: 1,
    MediaMagnet: 1,
    dwangoAC: 1
};

/* Colors to use for users without username colors specified */
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

