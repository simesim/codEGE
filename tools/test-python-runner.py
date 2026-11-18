import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('runner', root / 'js/python-runner.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

def run(code, stdin='', files=None, variables=None):
    return json.loads(runner.run_test(json.dumps(dict(code=code, stdin=stdin, files=files or {}, variables=variables or {}))))

def norm(s): return ' '.join(s.split())
n = 0
for config_path in root.glob('data/task-*/*/config.json'):
    cfg = json.loads(config_path.read_text(encoding='utf-8'))
    code = config_path.with_name('template.py').read_text(encoding='utf-8')
    for test in cfg['tests']:
        files = {name: value['text'] if 'text' in value else (config_path.parent / value['path']).read_text(encoding='utf-8') for name, value in test.get('files', {}).items()}
        r = run(code, test.get('stdin', ''), files, test.get('variables', {}))
        assert not r['error'] and norm(r['stdout']) == norm(test['expected']), (cfg['id'], test['id'], r)
        n += 1
assert run('print(int(input()) + int(input()))', '2\n3\n')['stdout'] == '5\n'
assert run('print(input(), input())', 'a\n\n')['stdout'] == 'a \n'
assert run('print(n)', variables={'n': 8})['stdout'] == '8\n'
assert run('print(open("nested/данные.txt").read())', files={'nested/данные.txt':'АБВ'})['stdout'] == 'АБВ\n'
assert run('x = 4\nopen("temp.txt", "w").write("x")')['error'] is None
assert run('print(x)')['error']['type'] == 'NameError'
assert run('print(open("temp.txt").read())')['error']['type'] == 'FileNotFoundError'
assert run('a=1\nprint(a/0)')['error']['line'] == 2
assert run('if True\n    print(1)')['error']['type'] == 'SyntaxError'
assert run('if True:\nprint(1)')['error']['type'] == 'IndentationError'
assert run('print(123, end="")')['stdout'] == '123'
assert run('print("x"*33000)')['error']['type'] == 'OutputLimit'
assert run('raise SystemExit(0)')['error'] is None
assert run('raise SystemExit(1)')['error']['type'] == 'SystemExit'
assert run('input()')['error']['type'] == 'EOFError'
print(f'OK: {n} исходных тестов + 15 дополнительных проверок CPython')
