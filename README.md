# freenom-dns
An unofficial node.js implementation for managing freenom.com dns records.

##Freenom
freenom.com is a ccTLD register service, which has several free domains for users to register for free (.tk, .ml, .ga, etc...)
However, except web UI,  freenom does not provide friendly API interfaces for developers to update DNS records.
Thus, this module is intend to wrap DNS management web interface and provide some convenient node.js API for you. And the final goal is to provide full set of freenom management API interface, plus some extra features such as ddns functionality.


## Command Interface
### Install
	npm install -g freenom-dns
[Node.js](https://nodejs.org/en/download/package-manager/) and [npm](https://www.npmjs.com/) are required to use this tool

### Usage
	Commands:
		login                              enter freenom login info
	    list [<domain>]                    list domains or records of the domain
	    set <fqdn> <type> <value> [<ttl>]  add/edit a DNS record
	    clear <fqdn> <type>                delete a DNS record

	  Options:
	    -h, --help     output usage information
	    -V, --version  output the version number

### How to use

1. First of all, you need to have a [freenom](freenom.com) account, and register for a domain (free or paid).
2. Run login command, you will be prompt to input your credential.

        $ freenom-dns login
        email: your@email.com
        password: ********

3. list your domains by the following command

		  Domain              Status    Expiry Date
		  ----------------   --------   -------------
		  domain1.tk         Active    29/07/2017
          domain2.tk         Active    29/07/2017

4. list records for specific domain.

		  Name             Type       Value
		  --------------   --------   ----------------------------
					              A          1.2.3.4
                   www            A          1.2.3.4
	              TEST        CNAME      google.com

5. now you can add/edit via command line, such as

		$ freenom-dns set www.domain1.tk A 2.3.4.5
	Please note that you have to enter full domain(FQDN) here, so the API could locate the correct domain for you.

6. also, you could clear a record by specifying FQDN and type

		$freenom-dns clear www.domain1.tk  A

7. for detailed command format, please see

        $freenom-dns -h

##API
###Install
	npm install --save freenom-dns

###How to use
First of all, initialize freenom object with your login credential.

		var user = "YOUR EMAIL";
		var pass ="YOUR PASSWORD";
		var freenom = require("freenom-dns").init(user, pass);

Then you can call one of the exported api, such as

		freenom.dns.setRecord("subdomain.domain.tk", "CNAME", "www.google.com", 1440)
			    .then(function(ret) {
					console.log(ret)
				})
			    .catch((err) => {
			        console.log(err);
			    });

The API is in promise style, you can get the result from then() callback if success, or get error reason from catch() callback if failed.
For other samples, please checkout examples/

###Available methods
* dns
	* listDomains() - list your domains
	* listRecords(fqdn) - list records for specific domain.
	* setRecord(fqdn, type, value[, ttl]) - add/edit DNS record
	* clearRecord(fqdn, type) - clear a record

where type should be one of the following DNS record type.
* A
* AAAA
* CNAME
* LOC
* MX
* NAPTR
* RP
* TXT

##Reference
[Freenom offical web site](http://www.freenom.com/)

##Credits
* [lpinca/freenom](https://www.npmjs.com/package/freenom) - freenom API interfaces, but lack of dns record support.
* [a-c-t-i-n-i-u-m/freenom.com.ddns.sh](https://gist.github.com/a-c-t-i-n-i-u-m/bc4b1ff265b277dbf195) - awesome shell script to support ddns.

## License
[MIT](LICENSE)
