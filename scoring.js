var stemmer = require('porter-stemmer').stemmer

// TODO scores for:
// item popularity
// items that users click on
// items that are purchased
// similarity to search
// reviews

// TODO boost for exact match on browse node name, and boost any nearby nodes
//  prefer exact match nodes and their children
// TODO classifer for search queries to browse nodes

module.exports = {
  DEPTH_WEIGHT: 1,    // multiplier applied for each level in the amazon hierarchy
  NODE_COUNT_WEIGHT: 1.2,

  DUPLICATE_WEIGHT: 1.1,    // boost applied each successive time an item appears in results
  CROSS_BROWSENODE_WEIGHT: 1.4, // duplicates across browse nodes- this means item was best in two categories

  BROWSENODE_EXACT_MATCH_WEIGHT: 3,
  BROWSENODE_FUZZY_MATCH_WEIGHT: 2.5,
  BROWSENODE_DISTANCE_INVERSE_WEIGHT: 1.6,

  NAME_FUZZY_MATCH_WEIGHT: 3,

  LENGTH_WEIGHT: 0.7,
  LENGTH_WEIGHT_THRESHOLD: 100,  // apply length weight to anything with this long of a title

  BOOK_WEIGHT: 0.6, // applied to books and ebooks

  WISHEDFOR_WEIGHT: 1.9,  // boost if it was wished for
  GIFTED_WEIGHT: 1.7, // boost if it was in a most gifted list
  TOPSELLERS_WEIGHT: 1.55,

  adjustResultScore: function(result, query) {
    // Final adjustments for the candidate in this browsenode category
    // Returns True if result should be shown

    // Penalize long boring items
    if (result.item.Title.length > this.LENGTH_WEIGHT_THRESHOLD) {
      //result.score *= this.LENGTH_WEIGHT;
    }

    if (new RegExp(stemmer(query), 'i').test(result.item.Title)) {
      result.score *= this.NAME_FUZZY_MATCH_WEIGHT;
    }

    // Penalize books :(
    if (result.item.ProductGroup == 'Book' || result.item.ProductGroup == 'eBooks') {
      result.score *= this.BOOK_WEIGHT;
    }

    if (result.item.type.indexOf('MostWishedFor') > -1) {
      result.score *= this.WISHEDFOR_WEIGHT;
    }
    if (result.item.type.indexOf('MostGifted') > -1) {
      result.score *= this.GIFTED_WEIGHT;
    }
    if (result.item.type.indexOf('TopSellers') > -1) {
      result.score *= this.TOPSELLERS_WEIGHT;
      if (result.item.type.length == 1) {
        // Don't show something that is *only* a top seller
        return false;
      }
    }
    return true;
  },

}
