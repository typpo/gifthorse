#!/usr/bin/perl -w
# get_reviews.pl
#
# A script to scrape Amazon, retrieve
# reviews, and write to a file.
# Usage: perl get_reviews.pl <asin>
# http://oreilly.com/pub/h/977
use strict;
use LWP::Simple;

# Take the ASIN from the command line.
my $asin = shift @ARGV or die "Usage: perl get_reviews.pl <asin>\n";

# Assemble the URL from the passed ASIN.
my $url = "http://amazon.com/o/tg/detail/-/$asin/?vi=customer-reviews";

# Set up unescape-HTML rules. Quicker than URI::Escape.
my %unescape = ('&quot;'=>'"', '&amp;'=>'&', '&nbsp;'=>' ');
my $unescape_re = join '|' => keys %unescape;

# Request the URL.
my $content = get($url);
die "Could not retrieve $url" unless $content;

# Loop through the HTML, looking for matches
while ($content =~ m!<img.*?stars-(\d)-0.gif.*?>.*?<b>(.*?)</b>, (.*?)\n.
*?Reviewer:\n<b>\n(.*?)</b>.*?</table>\n(.*?)<br>\n<br>!mgis) {

    my($rating,$title,$date,$reviewer,$review) =
                      ($1||'',$2||'',$3||'',$4||'',$5||'');
    $reviewer =~ s!<.+?>!!g;   # drop all HTML tags
    $reviewer =~ s!\(.+?\)!!g; # remove anything in parenthesis
    $reviewer =~ s!\n!!g;      # remove newlines
    $review =~ s!<.+?>!!g;     # drop all HTML tags
    $review =~ s/($unescape_re)/$unescape{$1}/migs; # unescape.

    # Print the results
    print "$title\n" . "$date\n" . "by $reviewer\n" .
          "$rating stars.\n\n" . "$review\n\n";

}
