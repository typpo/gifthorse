var stemmer = require('porter-stemmer').stemmer

// TODO scores for:
// item popularity
// items that users click on
// items that are purchased
// similarity to search
// reviews
// blacklist

// TODO boost for exact match on browse node name, and boost any nearby nodes
//  prefer exact match nodes and their children
// TODO classifer for search queries to browse nodes
//
// TODO automatically force categories if there is a stemmed match, eg. Elephants for query "elephant"
//
// TODO when deduping, also don't show results that are too similar, eg. for elephants there are like
// 10 books with "(An Elephant and Piggie Book)"

module.exports = {
  DEPTH_WEIGHT: 1,    // multiplier applied for each level in the amazon hierarchy
  NODE_COUNT_WEIGHT: 1.2,

  DUPLICATE_WEIGHT: 1.5,    // boost applied each successive time an item appears in results
  CROSS_BROWSENODE_WEIGHT: 1.4, // duplicates across browse nodes- this means item was best in two categories

  BROWSENODE_EXACT_MATCH_WEIGHT: 3,
  BROWSENODE_FUZZY_MATCH_WEIGHT: 1.7,
  BROWSENODE_DISTANCE_INVERSE_WEIGHT: 1.6,

  NAME_FUZZY_MATCH_WEIGHT: 3,

  FUZZY_MATCH_EXCLUDE: ['read','movie','video game', 'run','book'],   // some queries are too generic and we don't want to give them special weight

  LENGTH_WEIGHT: 0.7,
  LENGTH_WEIGHT_THRESHOLD: 100,  // apply length weight to anything with this long of a title

  BOOK_WEIGHT: 0.1, // applied to books and ebooks
  NO_BOOK_WEIGHT_FOR_QUERIES: ['read', 'book', 'comic'],    // don't apply the book weight if they're looking for books

  WISHEDFOR_WEIGHT: 1.9,  // boost if it was wished for
  GIFTED_WEIGHT: 1.7, // boost if it was in a most gifted list
  TOPSELLERS_WEIGHT: 1.55,

  adjustResultScore: function(result, query) {
    // Final adjustments for the candidate in this browsenode category
    // Returns True if result should be shown

    // Fuzzy matching things against query
    var skip_fuzzy_matches = false;
    for (var i=0; i < this.FUZZY_MATCH_EXCLUDE.length; i++) {
      var excludeme = this.FUZZY_MATCH_EXCLUDE[i];
      if (new RegExp(excludeme, 'i').test(query)) {
        skip_fuzzy_matches = true;
      }
    }

    var stemmed_query = stemmer(query);
    if (!skip_fuzzy_matches) {
      // TODO tokenize and stem this shit first, otherwise 'skiing' will match 'skills'
      if (new RegExp(stemmed_query, 'i').test(result.item.Title)) {
        result.score *= this.NAME_FUZZY_MATCH_WEIGHT;
      }
      if (new RegExp(stemmed_query, 'i').test(result.bName)) {
        result.score *= this.BROWSENODE_FUZZY_MATCH_WEIGHT;
      }
    }

    // Penalize books :(
    if ((result.item.ProductGroup === 'Book' || result.item.ProductGroup === 'eBooks')
        && this.NO_BOOK_WEIGHT_FOR_QUERIES.indexOf(stemmed_query) < 0) {
      result.score *= this.BOOK_WEIGHT;
    }
    // Penalize long boring items
    if (!result.item.Title) return false;

    if (result.item.Title.length > this.LENGTH_WEIGHT_THRESHOLD) {
      //result.score *= this.LENGTH_WEIGHT;
    }

    // Boost depending on how we found the item
    if (result.item.type.indexOf('MostWishedFor') > -1) {
      result.score *= this.WISHEDFOR_WEIGHT;
    }
    if (result.item.type.indexOf('MostGifted') > -1) {
      result.score *= this.GIFTED_WEIGHT;
    }
    if (result.item.type.indexOf('TopSellers') > -1) {
      result.score *= this.TOPSELLERS_WEIGHT;
      if (result.item.type.length === 1) {
        // Don't show something that is *only* a top seller
        return false;
      }
    }
    return true;
  },

}
