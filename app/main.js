var express = require('express')
  , fs = require('fs')
  , _ = require('underscore')
  , winston = require('winston')
  , app = express.createServer()
  , config = require('./config.js')
  , amazon = require('./amazon/amazon.js')
  , suggest = require('./brain/suggest.js')

// Express config
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(express.cookieParser());
//var RedisStore = require('connect-redis')(express);
//app.use(express.session({secret: "some key", /*store: new RedisStore*/}));
app.use(express.favicon(__dirname + '/public/favicon.ico'));
app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());

// App

/* Homepage */
app.get('/', function(req, res) {
  homepage(req, res, {});
});

app.get('/pbj', function(req, res) {
  homepage(req, res, {admin:true});
});

function homepage(req, res, opts) {
  res.render('index', {
    admin: opts.admin,
  });
}

app.get('/lookup/:keyword', function(req, res) {
  amazon.search(req.params.keyword, function(err, item) {
    res.send(item);
  });
});

app.get('/suggest/:keywords', function(req, res) {
  var kws = req.params.keywords.split(',');
  res.send(suggest.suggestionsFromQueries(kws, 2));
});

var port = process.env.PORT || 8080;
app.listen(port);

winston.info('Started listening on port 8080');
