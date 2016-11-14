var user = "[your email]";
var pass = "[your password]";
var freenom = require("freenom-dns").init(user, pass);

/*
//1. list domains
freenom.dns.listDomains()
    .then(function(ret){
        console.log(ret);
    })
    .catch((err) => {
        console.log(err);
    });
*/

//2. list domains
/*
freenom.dns.listRecords("[your domain]")
    .then(function(ret){
        console.log(ret);
    })
    .catch((err) => {
        console.log(err);
    });
*/

//3. set record
/*
freenom.dns.setRecord("[your.subdomain.xyz]", "A", "1.2.3.4")
    .then((ret) => console.log(ret))
    .catch((err) => {
        console.log(err);
    });
*/

//4. clear record
freenom.dns.clearRecord("[your.subdomain.xyz]", "A")
    .then((ret) => console.log(ret))
    .catch((err) => {
        console.log(err);
    });
