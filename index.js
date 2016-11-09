'use strict'

freenomDnsManager.prototype.listDomains = listDomains;
freenomDnsManager.prototype.listRecords = listRecords;
freenomDnsManager.prototype.edit = editRecord;
freenomDnsManager.prototype.delete = deleteRecord;
module.exports = freenomDnsManager;

var Q = require('q');
var cheerio = require("cheerio");

function freenomDnsManager(user, pass) {
    this.credential = {username: user, password: pass};
    this.request = require("request").defaults({jar: true});
}

function maybeLogin() {
    var deferred = Q.defer();
    var html = "";
    this.request.post({
        url:'https://my.freenom.com/dologin.php',
        form: this.credential},
        function(err, res, body) {
            if(err)
                deferred.reject("Login: " + err);
            else {
                if(res.statusCode >= 400 && res.statusCode < 500)
                    deferred.reject("Login" + res.statusCode);
                else {
                    var login = res.headers.location.indexOf("incorrect=true") == -1;
                    console.log("LOGIN=" + login);
                    if(login)
                        deferred.resolve();
                    else
                        deferred.reject("Login: login failed, please check email/password");
                }
            }
        });
    return deferred.promise;
}

function listDomains() {
    var deferred = Q.defer();
    var ret = [];
    maybeLogin.call(this).then(function(){
        var html = "";
        this.request.get('https://my.freenom.com/clientarea.php?action=domains')
        .on('data', function(chunk){
            html += chunk;
        }).on('error', function(err) {
            deferred.reject(err);
        }).on('end', function() {
            var h = cheerio.load(html);
            var tr = h("table.table-striped tbody tr");
            for(var i = 0; i < tr.length; i++) {
                var name = h(tr).find("td.second").text().trim();
                var reg =  h(tr).find("td.third").text();
                var expiry =  h(tr).find("td.fourth").text();
                var status = h(tr).find("td.fifth span").text();
                var type = h(tr).find("td.sixth").text();
                var link = h(tr).find("td.seventh a").attr("href");
                var url = require('url').parse(link, true);
                var id = url.query.id;
                if(name && link && id && status)
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
    }.bind(this));
    return deferred.promise;
}

function listRecords(domain) {
    var deferred = Q.defer();
    var ret = [];
    if(!domain) {
        deferred.reject("listRecords: domain is null");
        return deferred.promise;
    }
    listDomains.call(this).then(function(list){
        var html = "";
        var item;
        for(var i=0; i < list.length; i++) {
            if(domain === list[i].name) {
                item = list[i];
                break;
            }
        }
        if(!item) {
            deferred.reject("listRecords: cannot find " + domain);
            return deferred.promise;
        }
        console.log("listRecords: req=" + JSON.stringify(item));
        var url = "https://my.freenom.com/clientarea.php?managedns=" + domain + "&domainid=" + item.id;
        console.log("listRecords: url=" + url); 
        this.request.get(url)
        .on('data', function(chunk){
            html += chunk;
        }).on('error', function(err) {
            deferred.reject(err);
        }).on('end', function() {
            var h = cheerio.load(html);
            var table = h("section.domainContent table:first-of-type");
            var tr = h(table[0]).find("tbody tr");
            for(var i = 0; i < tr.length; i++) {
                //console.log("[DEBUG] TR=" + h(tr[i]).html());
                var name = h(tr[i]).find("input[name='records["+ i +"][name]']").val();
                var type = h(tr[i]).find("input[name='records["+ i +"][type]']").val();
                var ttl = h(tr[i]).find("input[name='records["+ i +"][ttl]']").val();
                var value = h(tr[i]).find("input[name='records["+ i +"][value]']").val();
                ret.push({
                    name: name,
                    type: type,
                    ttl: ttl,
                    value: value
                });
            }
            deferred.resolve(ret);
        });
    }.bind(this));
    return deferred.promise;
}

function editRecord(type, domain, value) {

}

function deleteRecord(type, domain) {

}