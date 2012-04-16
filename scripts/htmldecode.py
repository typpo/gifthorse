#!/usr/bin/env python

import sys, HTMLParser

if len(sys.argv) != 2:
  print 'usage: htmldecode /path/to/file'
  sys.exit(1)

h = HTMLParser.HTMLParser()

f = open(sys.argv[1], 'r')
stuff = f.read().splitlines()
f.close()

for line in stuff:
  print h.unescape(line)
