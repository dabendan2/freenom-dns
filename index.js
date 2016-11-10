'use strict'

exports.listDomains = listDomains;
exports.listRecords = listRecords;
exports.editRecord = editRecord;
exports.deleteRecord = deleteRecord;
exports.init = init;

var Q = require('q');
var cheerio = require("cheerio");
var async = require('async');

var credential;
var request = require("request").defaults({
    jar: true
});

function init(user, pass) {
    credential = {
        username: user,
        password: pass
    };
    return this;
}

//private
//Input: cheerio instance
//Output: boolean
function isLoginNeeded(h) {

}

//private
//Input:
//Output: promise
function Login() {
    var deferred = Q.defer();
    var html = "";
    request.post({
            url: 'https://my.freenom.com/dologin.php',
            form: credential
        },
        function(err, res, body) {
            if (err)
                deferred.reject("Login: " + err);
            else {
                if (res.statusCode >= 400 && res.statusCode < 500)
                    deferred.reject("Login" + res.statusCode);
                else {
                    //console.log("[DEBUG] HEADER=" + JSON.stringify(res.headers));
                    var login = res.headers.location.indexOf("incorrect=true") == -1;
                    console.log("LOGIN=" + login);
                    if (login) {
                        deferred.resolve();
                    } else
                        deferred.reject("Login: login failed, please check email/password");
                }
            }
        });
    return deferred.promise;
}

function listDomains() {
    var deferred = Q.defer();
    var ret = [];
    Login().then(function() {
        var html = "";
        request.get('https://my.freenom.com/clientarea.php?action=domains')
            .on('data', function(chunk) {
                html += chunk;
            }).on('error', function(err) {
                deferred.reject(err);
            }).on('end', function() {
                var h = cheerio.load(html);
                var token = h("input[name=token]").val();
                if (token) {
                    credential.token = token;
                }
                var tr = h("table.table-striped tbody tr");
                for (var i = 0; i < tr.length; i++) {
                    var name = h(tr).find("td.second").text().trim();
                    var reg = h(tr).find("td.third").text();
                    var expiry = h(tr).find("td.fourth").text();
                    var status = h(tr).find("td.fifth span").text();
                    var type = h(tr).find("td.sixth").text();
                    var link = h(tr).find("td.seventh a").attr("href");
                    var url = require('url').parse(link, true);
                    var id = url.query.id;
                    if (name && id)
                        ret.push({
                            name: name,
                            id: id,
                            status: status,
                            registration: reg,
                            expiry: expiry,
                            type: type
                        });
                }
                deferred.resolve(ret);
            });
    });
    return deferred.promise;
}

function listRecords(domain) {
    var deferred = Q.defer();
    var ret = [];
    if (!domain) {
        deferred.reject("listRecords: domain is null");
        return deferred.promise;
    }
    listDomains().then(function(list) {
        var html = "";
        var item;
        for (var i = 0; i < list.length; i++) {
            if (domain === list[i].name) {
                item = list[i];
                break;
            }
        }
        if (!item) {
            deferred.reject("listRecords: cannot find " + domain);
            return deferred.promise;
        }
        console.log("listRecords: req=" + JSON.stringify(item));
        var url = "https://my.freenom.com/clientarea.php?managedns=" + domain + "&domainid=" + item.id;
        console.log("listRecords: url=" + url);
        request.get(url)
            .on('data', function(chunk) {
                html += chunk;
            }).on('error', function(err) {
                deferred.reject(err);
            }).on('end', function() {
                var h = cheerio.load(html);
                var token = h("input#token").val();
                if (token) credential.token = token;
                var table = h("section.domainContent table:first-of-type");
                var tr = h(table[0]).find("tbody tr");
                for (var i = 0; i < tr.length; i++) {
                    //console.log("[DEBUG] TR[" + i + "]=" + h(tr[i]).html());
                    var name = h(tr[i]).find("input[name='records[" + i + "][name]']").val();
                    var type = h(tr[i]).find("input[name='records[" + i + "][type]']").val();
                    var ttl = h(tr[i]).find("input[name='records[" + i + "][ttl]']").val();
                    var value = h(tr[i]).find("input[name='records[" + i + "][value]']").val();
                    if (type)
                        ret.push({
                            name: name,
                            type: type,
                            ttl: ttl,
                            value: value
                        });
                }
                deferred.resolve(ret);
            });
    });
    return deferred.promise;
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

function editRecord(fqdn, type, value) {
    var deferred = Q.defer();
    async.waterfall([
        function(callback) {
            listDomains().then(function(domains) {
                var domain;
                for (var i = 0; i < domains.length; i++) {
                    if (fqdn.endsWith(domains[i].name)) {
                        domain = domains[i];
                        callback(null, domain);
                        return;
                    }
                }
                callback("editRecord: cannot find domain for " + fqdn);
            }).catch((err) => callback(err));
        },
        function(domain, callback) {
            listRecords(domain.name).then(function(records) {
                var record;
                var name = fqdn.toLowerCase().replace(domain.name.toLowerCase(), "").replace(/\.$/, "");
                console.log("editRecord: name = " + name +
                    " domain = " + domain.name +
                    " records = " + records.length);
                for (var i = 0; i < records.length; i++) {
                    if (name === records[i].name.toLowerCase()) {
                        record = records[i];
                        record.type = type;
                        record.name = fqdn;
                        record.value = value;
                        callback(null, domain, records);
                        return;
                    }
                }
                callback("editRecord: cannot find record for " + fqdn);
            }).catch((err) => callback(err));
        },
        function(domain, records, callback) {
            uploadRecords(domain, records)
                .then((result) => callback(null, result))
                .catch((err) => callback(err));
        }
    ], function(err, result) {
        if (!err)
            deferred.resolve(result);
        else
            deferred.reject(err);
    });
    return deferred.promise;
}

function uploadRecords(domain, records) {
    var deferred = Q.defer();
    console.log("uploadRecords: req = " + domain.name + " records = " + records.length);
    var form = new Object();
    var url = "https://my.freenom.com/clientarea.php?managedns=" + domain.name + "&domainid=" + domain.id;
    form.token = credential.token;
    form.dnsaction = "modify";
    form.records = {};
    for (var i = 0; i < records.length; i++) {
        form.records[i] = {};
        form.records[i]['name'] = records[i].name;
        form.records[i]['type'] = records[i].type;
        form.records[i]['ttl'] = records[i].ttl;
        form.records[i]['value'] = records[i].value;
    }
    //console.log("[DEBUG] FORM=" + JSON.stringify(form));
    request.post({
            url: url,
            form: form,
            followAllRedirects: true
        },
        function(err, res, body) {
            if (err)
                deferred.reject("uploadRecords: " + err);
            else {
                if (res.statusCode >= 400 && res.statusCode < 500)
                    deferred.reject("uploadRecords: " + res.statusCode);
                else {
                    //console.log("[DEBUG] STATUS=" + res.statusCode);
                    //console.log("[DEBUG] HEADER=" + JSON.stringify(res.headers));
                    //console.log("[DEBUG] BODY=" + body);
                    var h = cheerio.load(body);
                    var li = h("div.recordslist li");
                    var ret = [];
                    for (var i = 0; i < li.length; i++) {
                        var status = h(li[i]).attr("class") === "dnssuccess";
                        var reason = h(li[i]).text();
                        ret.push({
                            status: status,
                            reason: reason
                        });
                    }
                    deferred.resolve(ret);
                }
            }
        });
    return deferred.promise;
}

function deleteRecord(type, fqdn) {

}
