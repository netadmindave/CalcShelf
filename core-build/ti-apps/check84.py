#!/usr/bin/env python3
"""Static checks of the TI-84 programs: labels exist and are unique, Then/End balance, Menu( has at most 7 options, prgm calls exist."""
import json, os, re, sys
d = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'out', 'ti84'))
names = {e['name'] for e in json.load(open(os.path.join(d, 'index.json')))}
bad = 0
for e in json.load(open(os.path.join(d, 'index.json'))):
    src = open(os.path.join(d, e['file']), encoding='utf-8').read().split('\n')
    labels = [l[4:] for l in src if l.startswith('Lbl ')]
    errs = []
    if len(labels) != len(set(labels)): errs.append('duplicate labels')
    L = set(labels); depth = 0
    for i, l in enumerate(src):
        for g in re.findall(r'Goto (\w\w?)', l):
            if g not in L: errs.append('line %d: Goto %s has no Lbl' % (i + 1, g))
        if l.startswith('Menu('):
            parts = re.findall(r'"[^"]*",(\w\w?)', l)
            if len(parts) > 7: errs.append('line %d: Menu with %d options' % (i + 1, len(parts)))
            for g in parts:
                if g not in L: errs.append('line %d: Menu target %s has no Lbl' % (i + 1, g))
        for p in re.findall(r'prgm(\w+)', l):
            if p not in names: errs.append('line %d: prgm%s missing' % (i + 1, p))
        depth += l.count(':Then') + (1 if l == 'Then' else 0) - (1 if l == 'End' else 0)
        if depth < 0: errs.append('line %d: End without Then' % (i + 1)); depth = 0
    if depth: errs.append('Then/End off by %d' % depth)
    if any(len(x) > 2 for x in labels): errs.append('label longer than 2')
    if errs: bad += 1; print(e['name'], errs[:5])
print('%d programs checked, %d with problems' % (len(names), bad))
sys.exit(1 if bad else 0)
