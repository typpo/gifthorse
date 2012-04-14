// TODO scores for:
// item popularity
// similarity to search
// reviews
// most gifted vs most wanted (if it shows up in both)
// boost if the item showed up in most popular or most bought
// negative boost for books?

module.exports = {
  DUPLICATE_WEIGHT: 1.1,    // boost applied each successive time an item appears in results

  LENGTH_WEIGHT: 0.7,
  LENGTH_WEIGHT_THRESHOLD: 30,  // apply length weight to anything with this long of a title

  BOOK_WEIGHT: 0.8, // applied to ProductGroup Book

}
