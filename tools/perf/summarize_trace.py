"""Summarize an xctrace activity-monitor-process-live XML export; raw files stay outside git."""
import json, sys, xml.etree.ElementTree as ET
from collections import defaultdict
root=ET.parse(sys.argv[1]).getroot()
ids={e.attrib['id']:e for e in root.iter() if 'id' in e.attrib}
def resolve(e):
    return ids[e.attrib['ref']] if 'ref' in e.attrib else e
def number(e):
    e=resolve(e)
    try:return float(e.text)
    except (ValueError,TypeError):return None
stats=defaultdict(list)
for row in root.iter('row'):
    c=list(row)
    if len(c)<11:continue
    process=resolve(c[1]);responsible=resolve(c[2]);cpu=number(c[6]);mem=number(c[10]);t=number(c[0])
    if cpu is None:continue
    name=process.attrib.get('fmt','unknown');owner=responsible.attrib.get('fmt','unknown')
    stats[(name,owner)].append((t,cpu,mem))
result=[]
for (name,owner),rows in stats.items():
    if not any(x in name.lower() for x in ['webkit','app (','backboard','springboard']):continue
    rows.sort();result.append({'process':name,'responsible':owner,'samples':len(rows),'cpuMean':round(sum(r[1] for r in rows)/len(rows),2),'cpuLast':rows[-1][1],'cpuMax':max(r[1] for r in rows),'memoryMiBStart':round(rows[0][2]/2**20,1),'memoryMiBEnd':round(rows[-1][2]/2**20,1),'memoryMiBMax':round(max(r[2] for r in rows)/2**20,1)})
print(json.dumps(result,indent=2))
