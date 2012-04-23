function getConnection() {
  if (process.env.NODE_ENV == 'production')
    redis = require('redis-url').connect(process.env.REDISTOGO_URL);
  else
    redis = require('redis-url').connect();
}

module.exports = {
  getCollection: getCollection,

}
