#!/usr/bin/env python

import operator

f = open('all.csv')
lines = f.read().splitlines()
f.close()

d = {}
for line in lines:
  parts = line.split(',')[1:]
  for part in parts:
    p = part.lower()
    if p in d:
      d[p] += 1
    else:
      d[p] = 1

ss = sorted(d.iteritems(), key=operator.itemgetter(1))
ss.reverse()
for s in ss:
  print s[0],':',s[1]
