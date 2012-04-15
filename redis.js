var redisurl = require('redis-url')

function getRedisConnection() {
  return redisurl.connect(process.env.REDISTOGO_URL || 'redis://localhost:6379');
}

module.exports = {
  getRedisConnection: getRedisConnection,
}
