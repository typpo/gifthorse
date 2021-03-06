//
// Use to compare two results to see if they are too similar
//
// Maybe overlapping ngrams would be better
//
// this is useful when deduping, also don't show results that are too similar, eg. for elephants there are like
// 10 books with "(An Elephant and Piggie Book)"
// http://stackoverflow.com/questions/70560/how-do-i-compare-phrases-for-similarity
//

function cleanstring(str) {
  return str.replace(/[^\w\s]|_/g, "")
           .replace(/\s+/g, " ");
}

function similarity(p1, p2) {
  var v1 = cleanstring(p1).split(' '),
      v2 = cleanstring(p2).split(' ');
}
