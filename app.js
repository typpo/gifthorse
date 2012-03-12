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
var RedisStore = require('connect-redis')(express);
app.use(express.session({secret: "some key", /*store: new RedisStore*/}));
app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());

// App

/* Homepage */
app.get('/', function(req, res) {
  res.render('index', {

  });
});

app.get('/lookup/:keyword', function(req, res) {
  amazon.search(req.params.keyword);

  res.send('');

});

app.listen(8080);

winston.info('Started listening on port 8080');
