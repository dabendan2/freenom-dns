'use strict'

exports.listDomains = listDomains;
exports.listRecords = listRecords;
exports.setRecord = setRecord;
exports.clearRecord = clearRecord;
exports.init = init;

var Q = require('q');
var cheerio = require("cheerio");
var async = require('async');
var debug = require('debug')('freenom.d');
var debugv = require('debug')('freenom.v');

var credential;
var request = require("request").defaults({
    jar: true
});
var context = {};

function init(user, pass) {
    //TODO: if lists/cookies are available, restore from file
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
    return h("section.login").length > 0;
}

//private
//Input:
//Output: promise
function Login() {
    debug("Login: ++");
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
                    deferred.reject("Login: " + res.statusCode);
                else {
                    debugv("HEADER=" + JSON.stringify(res.headers));
                    var login = res.headers.location.indexOf("incorrect=true") == -1;
                    debug("Login: " + login);
                    if (login) {
                        deferred.resolve();
                    } else
                        deferred.reject("Login: login failed, please check email/password");
                }
            }
        });
    return deferred.promise;
}

//try f, if login is needed login first
//TODO: rewrite it
function runFuncWithRetry(f, args) {
    var deferred = Q.defer();
    f.apply(this, args)
        .then((result) => deferred.resolve(result))
        .catch((err) => {
            if (err === "login is needed")
                Login()
                .then(() => {
                    f.apply(this, args)
                        .then((result) => deferred.resolve(result))
                        .catch((err) => deferred.reject(err));
                })
                .catch((err) => deferred.reject(err));
            else
                deferred.reject(err);
        });
    return deferred.promise;
}

function listDomains() {
    debug("listDomains: ++");
    return runFuncWithRetry(listDomainsWithoutRetry, []);
}

function listDomainsWithoutRetry() {
    var deferred = Q.defer();
    var ret = [];
    var html = "";
    if (context.mDomains) {
        deferred.resolve(context.mDomains);
        return deferred.promise;
    }
    request.get('https://my.freenom.com/clientarea.php?action=domains')
        .on('data', function(chunk) {
            html += chunk;
        }).on('error', function(err) {
            deferred.reject(err);
        }).on('end', function() {
            var h = cheerio.load(html);
            if (isLoginNeeded(h)) {
                deferred.reject("login is needed");
                return deferred.promise;
            }
            var token = h("input[name=token]").val();
            if (token) {
                context.token = token;
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
            debug("listDomainsWithoutRetry: ret " + ret.length);
            context.mDomains = ret;
            deferred.resolve(ret);
        });
    return deferred.promise;
}

function findDomainBySuffix(req, callback) {
    listDomains().then(function(domains) {
        var domain;
        for (var i = 0; i < domains.length; i++) {
            if (req.endsWith(domains[i].name)) {
                domain = domains[i];
                callback(null, domain);
                return;
            }
        }
        callback("editRecord: cannot find domain for " + req);
    }).catch((err) => callback(err));
}

function listRecords(domain) {
    debug("listRecords: ++");
    return runFuncWithRetry(listRecordsWithoutRetry, [domain]);
}

function listRecordsWithoutRetry(req) {
    var deferred = Q.defer();
    if (!req) {
        deferred.reject("listRecords: domain is null");
        return deferred.promise;
    }
    if (context.mRecords) {
        var ret = context.mRecords[req];
        if (ret) {
            deferred.resolve(ret);
            return deferred.promise;
        }
    }
    findDomainBySuffix(req, function(err, domain) {
        if (err) {
            deferred.reject(err);
        } else {
            debug("listRecords: req=" + req);
            var url = "https://my.freenom.com/clientarea.php?managedns=" + domain.name + "&domainid=" + domain.id;
            request.get(url, null, handleListRecordResult.bind(null, domain, deferred));
        }
    });
    return deferred.promise;
}

function handleListRecordResult(domain, deferred, err, res, body) {
    if (err) {
        deferred.reject(err);
        return;
    }
    if (res.statusCode >= 400 && res.statusCode < 500) {
        deferred.reject("listRecords: " + res.statusCode);
        return;
    }
    var h = cheerio.load(body);
    if (isLoginNeeded(h)) {
        deferred.reject("login is needed");
        return;
    }
    var token = h("input#token").val();
    if (token) context.token = token;
    var table = h("section.domainContent table:first-of-type");
    var tr = h(table[0]).find("tbody tr");
    var ret = [];
    for (var i = 0; i < tr.length; i++) {
        debugv("TR[" + i + "]=" + h(tr[i]).html());
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
    if (!context.mRecords)
        context.mRecords = {};
    context.mRecords[domain.name] = ret;
    deferred.resolve(ret);
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

function setRecord(fqdn, type, value, ttl) {
    debug("setRecord:++");
    var deferred = Q.defer();
    async.waterfall([
        findDomainBySuffix.bind(null, fqdn),
        function(domain, callback) { //find record in this domain
            listRecords(domain.name).then(function(records) {
                records = records.slice(); //clone array
                var name = fqdn.toLowerCase().replace(domain.name.toLowerCase(), "").replace(/\.$/, "");
                debug("editRecord: name = " + name +
                    " domain = " + domain.name +
                    " records = " + records.length);
                var record;
                var i;
                for (i = 0; i < records.length; i++) {
                    if (name === records[i].name.toLowerCase() &&
                        type.toLowerCase() === records[i].type.toLowerCase()) {
                        record = records[i];
                        break;
                    }
                }
                if (!record) {
                    records[i] = {};
                    record = records[i];
                }
                if (record) {
                    if (!value) //delete item
                        records.splice(i, 1);
                    else {
                        record.type = type;
                        record.name = fqdn;
                        record.value = value;
                        if (!record.ttl || typeof ttl != "undefined")
                            record.ttl = (typeof ttl != "undefined" ? ttl : 1440);
                    }
                }
                callback(null, domain, records);
            }).catch((err) => callback(err));
        }, //edit and upload
        function(domain, records, callback) {
            updateRecords(domain, records)
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

function updateRecords(domain, records) {
    return runFuncWithRetry(updateRecordsWithoutRetry, [domain, records]);
}

function updateRecordsWithoutRetry(domain, records) {
    var deferred = Q.defer();
    var oriList = context.mRecords[domain.name];
    debug("records " + oriList.length + " -> " + records.length);
    var opt = {
        url: "https://my.freenom.com/clientarea.php?managedns=" +
            domain.name + "&domainid=" + domain.id,
        followAllRedirects: true
    };
    if (oriList.length < records.length) {
        opt.form = {
            dnsaction: "add",
            addrecord: {},
            token: context.token
        };
        opt.method = "POST";
        for (var i = oriList.length; i < records.length; i++) {
            opt.form.addrecord[i] = records[i];
        }
    } else if (oriList.length == records.length) {
        opt.form = {
            dnsaction: "modify",
            records: {},
            token: context.token
        };
        opt.method = "POST";
        for (var i = 0; i < records.length; i++) {
            opt.form.records[i] = records[i];
        }
    } else {
        opt.method = "GET";
        var i;
        for (i = 0; i < records.length; i++)
            if (oriList[i].name != records[i].name ||
                oriList[i].type != records[i].type) {
                break;
            }
        opt.qs = {
            dnsaction: "delete",
            name: oriList[i].name,
            records: oriList[i].type,
            ttl: oriList[i].ttl,
            value: oriList[i].value
        };
    }
    debug("updateRecords: action = " + (opt.form ? opt.form.dnsaction : opt.qs.dnsaction));
    debugv("REQ=" + JSON.stringify(opt));
    request(opt, handleModifyRecordResult.bind(null, domain, deferred));
    return deferred.promise;
}

function handleModifyRecordResult(domain, deferred, err, res, body) {
    if (err) {
        deferred.reject(err);
        return;
    }
    if (res.statusCode >= 400 && res.statusCode < 500) {
        deferred.reject("updateRecords: " + res.statusCode);
        return;
    }
    var h = cheerio.load(body);
    if (isLoginNeeded(h)) {
        deferred.reject("login is needed");
        return;
    }
    debugv("STATUS=" + res.statusCode);
    debugv("HEADER=" + JSON.stringify(res.headers));
    debugv("BODY=" + body);
    var li = h("div.recordslist li");
    var ret = [];
    var failed = false;
    for (var i = 0; i < li.length; i++) {
        var status = h(li[i]).attr("class") === "dnssuccess";
        var reason = h(li[i]).text();
        if (status == false)
            failed = true;
        ret.push({
            status: status,
            reason: reason
        });
    }
    //invalidate cache
    context.mRecords[domain.name] = null;
    if (failed)
        deferred.reject(ret);
    else
        deferred.resolve(ret);
}

function clearRecord(fqdn, type) {
    return setRecord(fqdn, type, null);
}
