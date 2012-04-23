var redisurl = require('redis-url');
function getConnection() {
  return redisurl.connect(process.env.REDISTOGO_URL || 'redis://localhost:6379');
}

module.exports = {
  getConnection: getConnection,
}
