'use strict';

let _ = require('underscore');
let cleanse = require('sanitize-html');
let lda = require('lda');
let pg = require('pg');
let Spider = require('node-spider');
let validUrl = require('valid-url');

let followedUrls = [];

let pgCredentials = {
  username: process.env.PG_USER || '',
  password: process.env.PG_PASSWORD || '',
  url: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'cc_db'
};

let pgUri = "postgres://";
if (pgCredentials['username']) {
  pgUri += pgCredentials['username'];

  if (pgCredentials['password']) {
    pgUri += ':' + pgCredentials['password'];
  }

  pgUri += '@';
}
pgUri += pgCredentials['url'] + '/' + pgCredentials['database'];

let crawler = new Spider({
	// How many requests can be run in parallel
	concurrent: 5,
	// How long to wait after each request
	delay: 0,
	// A stream to where internal logs are sent, optional
	logs: process.stderr,
	// Re-visit visited URLs, false by default
	allowDuplicates: false,
	// If `true` all queued handlers will be try-catch'd, errors go to `error` callback
	catchErrors: true,
	// Called when there's an error, throw will be used if none is provided
	error: function(err, url) {
    console.error("Error encountered parsing: ", url, "\n", err);
	},
	// Called when there are no more requests
	done: function() {
    console.log("Finish processing.");
    process.exit(0);
	},

	//- All options are passed to `request` module, for example:
	headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36' },
	encoding: 'utf8'
});

let processDocument = (content) => {
  let text = cleanse(content, {
    allowedTags: [],
    allowedAttributes: []
  });
  let ldaAnalysis = lda(text.match(/[^\.!\?]+[\.!\?]+/g), 1, 10);
  return ldaAnalysis[0];
};

let storeAnaylsis = (analysis, url) => {
  pg.connect(pgUri, (error, client, done) => {
    if (error) {
      return console.error('Error connecting to Postgres database', error);
    }

    client.query("INSERT INTO crawls (id, url) VALUES (DEFAULT, $1) RETURNING id", [url], (error, result) => {
      if (error) {
        done();
        return console.error('Error inserting crawl: ', error);
      }

      let crawlId = result.rows[0].id;

      // Use a bulk insert rather than one by one for the terms
      let termsSql = _.reduce(analysis, (sql, term) => {
        return sql + '(DEFAULT, $1, \'' + term.term + '\', \'' + term.probability + '\'),';
      }, '').slice(0, -1);

     client.query('INSERT INTO crawl_results (id, crawl_id, term, probability) VALUES ' + termsSql,
      [crawlId], (error, result) => {
         if (error) {
           done();
           return console.error('Error inserting crawl result: ', error);
         }
         done();
       });
    });
  });
};

let resolveLinks = (links, resolve) => {

}

let handleRequest = (doc) => {
  if (doc.res && doc.res.body) {
    let ldaAnalysis = processDocument(doc.res.body);
    storeAnaylsis(ldaAnalysis, doc.res.request.href);
  }

  let validLinks = _.filter(doc.$('a'), (link) => {
    return link && link.attribs && link.attribs.href && link.attribs.href.length;
  });

  _.each(validLinks, (link) => {
    let href = link.attribs.href.split('#')[0];
    let url = doc.resolve(href);
    if (!_.contains(followedUrls, url)) {
      followedUrls.push(url);
      crawler.queue(url, handleRequest);
    }
  });
};

if (!process.argv[2] || !validUrl.isUri(process.argv[2])) {
  console.error('Please provide a root url to begin the crawl')
  process.exit(1);
}

crawler.queue(process.argv[2], handleRequest);
followedUrls.push(process.argv[2]);
