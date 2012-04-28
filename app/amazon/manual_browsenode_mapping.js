var stemmer = require('porter-stemmer').stemmer

var BROWSENODE_MAP = {
  'reading': [
  {BrowseNodeId:'51546011', Name: 'Books Featured Categories'},
  {BrowseNodeId:'44258011', Name: 'Features'},
  {BrowseNodeId:'220778011', Name: 'Arts & Literature'},
  {BrowseNodeId:'220814011', Name: 'Historical'},
  {BrowseNodeId:'20823011', Name: 'United States'},
  {BrowseNodeId:'20856011', Name: 'People'},
  {BrowseNodeId:'20855011', Name: 'Memoirs'},
  {BrowseNodeId:'21054011', Name: 'Business'},
  {BrowseNodeId:'21081011', Name: 'Adventurers & Explorers'},
  ],
  'skiing': [],
};

(function() {
  for (var key in BROWSENODE_MAP) {
    BROWSENODE_MAP[stemmer(key)] = BROWSENODE_MAP[key];
  }
})()

function lookupQuery(q) {
  return BROWSENODE_MAP[stemmer(q)];
}

module.exports = {
  lookupQuery: lookupQuery,

}
