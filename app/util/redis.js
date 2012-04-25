var redisurl = require('redis-url');
function getConnection() {
  try {
    return redisurl.connect(process.env.REDISTOGO_URL || 'redis://localhost:6379');
  }
  catch (e) {
    return null;
  }
}

module.exports = {
  getConnection: getConnection,
}
