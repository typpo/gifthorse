#!/usr/bin/env python

import HTMLParser, sys
h = HTMLParser.HTMLParser()


f = open(sys.argv[1], 'r')
stuff = f.read().splitlines()
f.close()

for line in stuff:
  print h.unescape(line)
