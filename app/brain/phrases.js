//
// Use to compare two results to see if they are too similar
//
// Maybe overlapping ngrams would be better
//

function cleanstring(str) {
  return str.replace(/[^\w\s]|_/g, "")
           .replace(/\s+/g, " ");
}

function similarity(p1, p2) {
  var v1 = cleanstring(p1).split(' '),
      v2 = cleanstring(p2).split(' ');
}
