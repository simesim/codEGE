"""Regression tests for validate.py; corruptions are made only in temporary copies."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('validator', root/'tools/validate.py')
v = importlib.util.module_from_spec(spec); spec.loader.exec_module(v)
catalog = v.read_json(root/'data/catalog.json')
task = catalog['tasks'][0]; entry = task['templates'][0]
folder = root/'data'/entry['path']
config = v.read_json(folder/'config.json'); code = (folder/'template.py').read_text(encoding='utf-8')

def rejects(fn, message):
    try: fn()
    except (ValueError, OSError, SyntaxError): return
    raise AssertionError(message)

assert v.validate_config(config, code, entry, task) == len(config['gaps'])
for field, value in [('id', 'wrong'), ('explanations', []), ('fullCodeHints', ['a','b','wrong'])]:
    damaged=copy.deepcopy(config); damaged[field]=value
    rejects(lambda: v.validate_config(damaged, code, entry, task), field)
damaged=copy.deepcopy(config); damaged['gaps'][0]['start'] += 1
rejects(lambda: v.validate_config(damaged, code, entry, task), 'split token')
damaged=copy.deepcopy(config); damaged['gaps'].append(damaged['gaps'][0])
rejects(lambda: v.validate_config(damaged, code, entry, task), 'duplicate gap')
for name, fspec in [('x.txt',{'path':'tests/missing.txt'}),('../x.txt',{'text':'x'}),('x.txt',{'path':'tests/../x.txt'}),('x.txt',{'path':'tests/x.txt','text':'x'})]:
    rejects(lambda: list(v.read_tests({'tests':[{'id':'t','expected':'0','files':{name:fspec}}]},folder)), 'invalid file')
assert v.normalize('  12\n\t24 ')=='12 24'
assert v.normalize('12 24')!=v.normalize('1224')
with tempfile.TemporaryDirectory() as d:
    tmp=Path(d); (tmp/'data').mkdir(); shutil.copytree(folder,tmp/'data'/entry['path']); (tmp/'data/catalog.json').write_text(json.dumps({'tasks':[dict(task,templates=[entry])]},ensure_ascii=False),encoding='utf-8'); (tmp/'js').mkdir(); shutil.copy2(root/'js/python-runner.py',tmp/'js/python-runner.py')
    target=tmp/'data'/entry['path']/'config.json'; broken=copy.deepcopy(config);broken['tests'][0]['expected']='incorrect';target.write_text(json.dumps(broken,ensure_ascii=False),encoding='utf-8')
    result=subprocess.run([sys.executable,'-B','-X','utf8',str(root/'tools/validate.py'),'--root',str(tmp)],capture_output=True,text=True,encoding='utf-8',timeout=30)
    assert result.returncode==1 and 'ожидалось' in result.stderr,result
    cat=v.read_json(tmp/'data/catalog.json');cat['tasks'][0]['templates'].append(cat['tasks'][0]['templates'][0]);(tmp/'data/catalog.json').write_text(json.dumps(cat,ensure_ascii=False),encoding='utf-8')
    result=subprocess.run([sys.executable,'-B','-X','utf8',str(root/'tools/validate.py'),'--root',str(tmp)],capture_output=True,text=True,encoding='utf-8',timeout=30)
    assert result.returncode==1 and 'повторная запись' in result.stderr,result
print('OK: validator rejects mismatched identity, explanations, hints, coordinates, duplicate gaps, invalid/missing files, wrong expected output and duplicate catalogue records.')
