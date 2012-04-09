var express = require('express')
  , fs = require('fs')
  , _ = require('underscore')
  , winston = require('winston')
  , app = express.createServer()
  , config = require('./config.js')
  , amazon = require('./amazon.js')

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
  res.render('index', {

  });
});

app.get('/lookup/:keyword', function(req, res) {
  amazon.search(req.params.keyword, function(err, item) {
    res.send(item);
  });

});

var port = process.env.PORT || 8080;
app.listen(port);

winston.info('Started listening on port 8080');
