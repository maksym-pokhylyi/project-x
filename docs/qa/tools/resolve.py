#!/usr/bin/env python3
"""Resolve git conflict hunks in a file.
usage: resolve.py <file> <default-mode> [<hunk-number>:<mode> ...]
modes: ours | theirs | both (ours then theirs) | rboth (theirs then ours)
Prints the number of hunks resolved. Hunk numbers start at 1."""
import re, sys
path, default = sys.argv[1], sys.argv[2]
per = dict((int(a.split(':')[0]), a.split(':')[1]) for a in sys.argv[3:])
s = open(path).read()
pat = re.compile(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', re.S)
n = 0
def pick(m):
    global n
    n += 1
    mode = per.get(n, default)
    ours, theirs = m.group(1), m.group(2)
    return {'ours': ours, 'theirs': theirs, 'both': ours + theirs, 'rboth': theirs + ours}[mode]
s = pat.sub(pick, s)
assert '<<<<<<< ' not in s and '>>>>>>> ' not in s, 'markers left'
open(path, 'w').write(s)
print(f'{path}: {n} hunk(s) resolved')
