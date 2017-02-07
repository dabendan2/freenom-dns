#!/usr/bin/env node

'use strict'

var program = require('commander');
var util = require('util');
var Preferences = require("preferences");
var prefs = new Preferences('dabendan.freenom-dns');
var inquirer = require('inquirer');
var AsciiTable = require('ascii-table');
var freenom = require('../index.js');
var debug = require('debug')("freenom.cli");

program
    .version(require('../package.json').version);

program
    .command('login')
    .description("enter freenom login info")
    .action(handleAskLogin);

program
    .command('list [<domain>]')
    .description("list domains or records of the domain")
    .action(handleListCmd);

program
    .command('set <fqdn> <type> <value> [<ttl>]')
    .description("add/edit a DNS record")
    .action(handleSetCmd);

program
    .command('clear <fqdn> <type>')
    .description("delete a DNS record")
    .action(handleClearCmd);

if (!process.argv.slice(2).length) {
    program.help();
} else if (process.argv[2] == "login") {
    program.parse(process.argv);
} else if (!prefs.account) {
    console.log('please login first.');
    process.exit();
} else {
    freenom.init(prefs.account.username, prefs.account.password);
    program.parse(process.argv);
}

function handleSetCmd(fqdn, type, value, ttl) {
    debug(" fqdn=" + fqdn + " type=" + type);
    freenom.dns.setRecord(fqdn, type.toUpperCase(), value, ttl)
        .catch((err) => console.log(err));
}

function handleClearCmd(fqdn, type) {
    freenom.dns.clearRecord(fqdn, type.toUpperCase())
        .catch((err) => console.log(err));
}

function handleListCmd(domain) {
    if (domain) {
        freenom.dns.listRecords(domain)
            .then((records) => {
                var table = new AsciiTable();
                table.addRow('Name', 'Type', "Value")
                    .addRow("--------------", "--------",
                        "----------------------------------------------")
                    .removeBorder();
                for (var i = 0; i < records.length; i++) {
                    table.addRow(records[i].name,
                        records[i].type,
                        records[i].value);
                }
                console.log(table.toString());
            })
            .catch((err) => {
                console.log(err);
            });
    } else {
        freenom.dns.listDomains()
            .then((domains) => {
                debug(util.inspect(domains));
                var table = new AsciiTable();
                table.addRow('Domain', 'Status', "Expiry Date");
                table.addRow("----------------", "--------", "-------------");
                table.setAlignCenter(1);
                for (var i = 0; i < domains.length; i++) {
                    table.addRow(domains[i].name,
                        domains[i].status, domains[i].expiry);
                }
                table.removeBorder();
                console.log(table.toString());
            })
            .catch((err) => {
                console.log(err);
            });
    }
}

function handleAskLogin(callback) {
    var questions = [{
        name: 'username',
        type: 'input',
        message: 'email:'
    }, {
        name: 'password',
        type: 'password',
        message: 'password:'
    }];
    inquirer.prompt(questions).then(function(ret) {
        prefs.account = ret;
        freenom.init(ret.username, ret.password);
        if (callback && typeof(callback) == "function")
            callback(null, prefs.account);
    });
}
