'use strict'

exports.dns = require('./lib/dns.js');
exports.init = init;

var credential;

function init(user, pass) {
    //TODO: if lists/cookies are available, restore from file
    credential = {
        username: user,
        password: pass
    };
    exports.dns.init(credential);
    return this;
}
