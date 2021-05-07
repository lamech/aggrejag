use strict;
use JSON::Lines;
use Data::Dumper;

my $jsonl = JSON::Lines->new();

my $all = $jsonl->decode_file('links.jsonl');

print Dumper $all;

