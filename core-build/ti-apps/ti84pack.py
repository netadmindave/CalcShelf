#!/usr/bin/env python3
"""Tokenize the TI-84 programs written by ti.js into .8xp files.  pip install tivars"""
import json, os, sys
from tivars import TIProgram
from tivars.models import TI_84P
d = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'out', 'ti84'))
total = 0
for e in json.load(open(os.path.join(d, 'index.json'))):
    src = open(os.path.join(d, e['file']), encoding='utf-8').read()
    p = TIProgram(name=e['name'])
    try: p.load_string(src, model=TI_84P)
    except Exception as ex: sys.exit('%s: %s' % (e['name'], ex))
    p.save(os.path.join(d, e['name'] + '.8xp'))
    n = len(p.bytes()); total += n
    if n > 20000: print('large:', e['name'], n)
print('%d programs, %d bytes' % (len(json.load(open(os.path.join(d, 'index.json')))), total))
