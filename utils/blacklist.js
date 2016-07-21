const blacklist = require('react-native/packager/blacklist');

let additionalBlacklist = [
    /Sample/
];

module.exports = function(platform) {
    return blacklist(platform || 'ios', additionalBlacklist);
}
