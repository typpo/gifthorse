#/usr/bin/env python

import bottlenose

amazon = bottlenose.Amazon(AMAZON_ACCESS_KEY_ID, AMAZON_SECRET_KEY, AMAZON_ASSOC_TAG)

response = amazon.ItemLookup(ItemId="0596520999", ResponseGroup="Images", \
    SearchIndex="Books", IdType="ISBN", \
    Style="http://xml2json-xslt.googlecode.com/svn/trunk/xml2json.xslt")

