var redisurl = require('redis-url');
var redis = redisurl.connect(process.env.REDISTOGO_URL || 'redis://localhost:6379');

function getConnection() {
  try {
    return redis;
  }
  catch (e) {
    return null;
  }
}

module.exports = {
  getConnection: getConnection,
}
