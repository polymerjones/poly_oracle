"""Summarize an xctrace time-profile XML export: per process, weight by thread and by the
deepest symbolized WebKit/WebCore/QuartzCore frame. Ranking aid only; raw traces stay outside git."""
import re, sys, xml.etree.ElementTree as ET
from collections import Counter, defaultdict
procs_of_interest = [p for p in sys.argv[2:]] or ['WebKit.GPU', 'backboardd', 'WebKit.WebContent', 'App (']
ids = {}
by_thread = defaultdict(Counter); by_frame = defaultdict(Counter); total = Counter()
INTERESTING = re.compile(r'^(WebCore|WebKit|JSC|CA::|IOSurface|AGX|MTL|CG|RB|Ripstop|ImageIO|AVF|VideoToolbox|WTF::RunLoop|ANGLE|gl::)')
def r(e):
    return ids.get(e.attrib['ref']) if 'ref' in e.attrib else e
for ev, e in ET.iterparse(sys.argv[1], events=('end',)):
    if 'id' in e.attrib: ids[e.attrib['id']] = e
    if e.tag != 'row': continue
    th = r(e.find('thread')); pr = r(e.find('process')); w = e.find('weight')
    if th is None or pr is None: continue
    pname = pr.attrib.get('fmt', '')
    key = next((p for p in procs_of_interest if p in pname), None)
    if not key: continue
    weight = float(r(w).text) / 1e6 if w is not None else 1.0  # ns -> ms
    tname = re.sub(r' \(0x[0-9a-f]+\).*', '', th.attrib.get('fmt', '?'))
    total[key] += weight; by_thread[key][tname] += weight
    bt = e.find('tagged-backtrace')
    label = '(no symbol)'
    if bt is not None:
        bt = r(bt); b = bt.find('backtrace')
        b = r(b) if b is not None else None
        if b is not None:
            for f in b.findall('frame'):
                f = r(f); n = f.attrib.get('name', '')
                if n and not n.startswith('0x') and not n.startswith('WTF::') and 'IPC::' not in n:
                    label = n[:110]; break
    by_frame[key][label] += weight
for k in procs_of_interest:
    if not total[k]: continue
    print(f'\n== {k}: {total[k]:.0f} ms sampled')
    print('  threads:'); [print(f'    {v:8.0f}  {n}') for n, v in by_thread[k].most_common(6)]
    print('  first symbolized frame:'); [print(f'    {v:8.0f}  {n}') for n, v in by_frame[k].most_common(14)]
