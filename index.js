'use strict'

exports.dns = require('./lib/dns.js');
exports.init = init;

var credential;

function init(user, pass) {
    credential = {
        username: user,
        password: pass
    };
    exports.dns.init(credential);
    return this;
}
