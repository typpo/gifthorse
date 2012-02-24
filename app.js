var express = require('express')
  , fs = require('fs')
  , app = express.createServer()
;

// Express config
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(express.cookieParser());
var RedisStore = require('connect-redis')(express);
app.use(express.session({secret: "some key", store: new RedisStore}));
app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());

// App

/* Homepage */
app.get('/', function(req, res) {
  res.render('index', {
    saved_info: req.session.info,
    saved_cc: req.session.customer != undefined,
    display: dishobjs,
    isOpen: function(){
      var ret = {};
      for (var i=0; i < dishobjs.length; i++) {
        ret[dishobjs[i].unique] = (restaurants.isOpen(dishobjs[i]));
        console.log(dishobjs[i].unique, (restaurants.isOpen(dishobjs[i])));
      }
      return ret;
    }(),
    slug: '',
  });
});

app.listen(8080);
