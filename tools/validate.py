#!/usr/bin/env python3
"""Validate trusted CodEGE materials before publishing. No third-party packages."""
import argparse
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tokenize
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
LEVELS = (15, 30, 50, 75)
IDENT = re.compile(r'[a-zA-Z0-9_-]+\Z')
PATH = re.compile(r'[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*\Z')
# The same whitespace set as JavaScript /\s/u and String.trim().
WS = re.compile(r'[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+')

def need(condition, message):
    if not condition:
        raise ValueError(message)

def text(value):
    return isinstance(value, str) and bool(value.strip())

def integer(value):
    return type(value) is int

def normalize(value):
    return WS.sub(' ', value).strip(' ')

def read_json(path):
    with path.open(encoding='utf-8') as handle:
        return json.load(handle, parse_constant=lambda v: (_ for _ in ()).throw(ValueError(f'Некорректное число JSON: {v}')))

def relative_file(name):
    return isinstance(name, str) and all(part not in ('', '.', '..') and all(c in '_. -' or unicodedata.category(c)[0] in 'LN' for c in part) for part in name.split('/'))

def inside(base, path):
    resolved = (base / path).resolve()
    need(resolved.is_relative_to(base.resolve()), f'Путь выходит за пределы папки: {path}')
    return resolved

def token_spans(code):
    lines = code.splitlines(keepends=True)
    starts = [0]
    for line in lines:
        starts.append(starts[-1] + len(line))
    def offset(position):
        line, column = position
        return starts[min(line - 1, len(starts)-1)] + column
    ignored = {'ENCODING', 'ENDMARKER', 'INDENT', 'DEDENT', 'NL', 'NEWLINE', 'COMMENT'}
    spans = []
    fstack = []
    for tok in tokenize.generate_tokens(io.StringIO(code).readline):
        kind = tokenize.tok_name[tok.type]
        if kind in ('FSTRING_START', 'TSTRING_START'):
            fstack.append(offset(tok.start)); continue
        if fstack:
            if kind in ('FSTRING_END', 'TSTRING_END'):
                start = fstack.pop()
                if not fstack:
                    spans.append((start, offset(tok.end)))
            continue
        if kind not in ignored and tok.string.strip():
            spans.append((offset(tok.start), offset(tok.end)))
    return spans

def validate_config(cfg, code, entry, task):
    need(isinstance(cfg, dict), 'config.json должен содержать объект')
    need(cfg.get('id') == entry['id'] and cfg.get('task') == task['number'] and cfg.get('title') == entry['title'], 'ID, номер задания или название не совпадают с каталогом')
    need(text(cfg.get('condition')), 'Нет краткого условия')
    compile(code, 'template.py', 'exec')
    lines = code.split('\n')
    if lines[-1] == '': lines.pop()
    explanations = cfg.get('explanations')
    need(isinstance(explanations, list) and explanations, 'Нет объяснений')
    seen = set()
    for item in explanations:
        need(isinstance(item, dict) and integer(item.get('line')) and 1 <= item['line'] <= len(lines) and item['line'] not in seen and text(item.get('text')), 'Неверное или повторное объяснение строки')
        seen.add(item['line'])
    need(all(i in seen for i, line in enumerate(lines, 1) if line.strip() and not line.lstrip().startswith('#')), 'Не все значимые строки имеют объяснение')
    def hints(value, original, label):
        need(isinstance(value, list) and len(value) == 3 and all(text(v) for v in value) and value[2] == original, f'Некорректные подсказки: {label}')
    hints(cfg.get('fullCodeHints'), code, '100%')
    spans = token_spans(code)
    need(spans, 'Пустая программа')
    gaps = cfg.get('gaps')
    need(isinstance(gaps, list) and gaps, 'Нет разметки пропусков')
    seen.clear(); counts = {n: [] for n in LEVELS}
    for gap in gaps:
        need(isinstance(gap, dict) and text(gap.get('id')) and gap['id'] not in seen, 'Некорректный или повторный ID пропуска')
        gid = gap['id']; seen.add(gid)
        a, b, levels = gap.get('start'), gap.get('end'), gap.get('levels')
        need(integer(a) and integer(b) and 0 <= a < b <= len(code), f'{gid}: неверные координаты')
        need(isinstance(levels, list) and levels and all(integer(x) and x in LEVELS for x in levels) and len(set(levels)) == len(levels), f'{gid}: неверные уровни')
        need(gap.get('kind') in ('element', 'line', 'block'), f'{gid}: неверный тип')
        touched = [(s,e) for s,e in spans if s < b and e > a]
        need(touched and all(a <= s and e <= b for s,e in touched), f'{gid}: пропуск разрывает токен или пуст')
        hints(gap.get('hints'), code[a:b], gid)
        for level in levels: counts[level].append(len(touched))
    for level, weights in counts.items():
        need(any(0 < w < len(spans) for w in weights), f'Нет допустимых пропусков для {level}%')
    return len(gaps)

def read_tests(cfg, folder):
    tests = cfg.get('tests')
    need(isinstance(tests, list) and tests, 'Нет тестов')
    ids = set()
    for test in tests:
        need(isinstance(test, dict) and text(test.get('id')) and test['id'] not in ids and isinstance(test.get('expected'), str) and isinstance(test.get('stdin', ''), str), 'Некорректный тест')
        ids.add(test['id'])
        files, variables = test.get('files', {}), test.get('variables', {})
        need(isinstance(files, dict) and isinstance(variables, dict), f'{test["id"]}: неверные файлы или переменные')
        need(all(name.isidentifier() and not name.startswith('__') for name in variables), f'{test["id"]}: неверное имя переменной')
        mapped = {}
        for name, spec in files.items():
            need(relative_file(name) and isinstance(spec, dict), f'{test["id"]}: неверное имя файла {name}')
            inline, external = isinstance(spec.get('text'), str), isinstance(spec.get('path'), str)
            need(inline != external, f'{test["id"]}: нужен text или path, но не оба')
            if inline: mapped[name] = spec['text']
            else:
                path = spec['path']
                need(relative_file(path) and path.startswith('tests/'), f'{test["id"]}: неверный путь {path}')
                mapped[name] = inside(folder, path).read_bytes().decode('utf-8')
        yield test['id'], test['expected'], dict(stdin=test.get('stdin', ''), files=mapped, variables=variables)

def execute(runner, code, payload):
    # A fresh CPython process per test; not a sandbox. Only trusted authors' code.
    child = subprocess.run([sys.executable, '-B', '-X', 'utf8', str(Path(__file__).resolve()), '--run-one', str(runner)], input=json.dumps(dict(payload, code=code)), capture_output=True, encoding='utf-8', timeout=10)
    need(child.returncode == 0, f'Ошибка процесса Python: {child.stderr[:800]}')
    return json.loads(child.stdout)

def validate(root):
    catalog = read_json(root / 'data/catalog.json')
    need(isinstance(catalog, dict) and isinstance(catalog.get('tasks'), list) and catalog['tasks'], 'Некорректный каталог')
    errors = []; seen = set(); numbers = set(); paths = set(); n = g = t = 0
    for task in catalog['tasks']:
        need(isinstance(task, dict) and integer(task.get('number')) and task['number'] > 0 and task['number'] not in numbers and text(task.get('title')) and isinstance(task.get('templates'), list) and task['templates'], 'Некорректный раздел каталога')
        numbers.add(task['number'])
        for entry in task['templates']:
            try:
                need(isinstance(entry, dict) and isinstance(entry.get('id'), str) and IDENT.fullmatch(entry['id']) and entry['id'] not in seen and text(entry.get('title')) and isinstance(entry.get('path'), str) and PATH.fullmatch(entry['path']) and entry['path'] not in paths, 'Некорректная или повторная запись каталога')
                seen.add(entry['id']); paths.add(entry['path'])
                folder = inside(root/'data', entry['path'])
                cfg = read_json(folder/'config.json'); code = (folder/'template.py').read_text(encoding='utf-8')
                gaps = validate_config(cfg, code, entry, task)
                count = 0; failures = []
                for tid, expected, payload in read_tests(cfg, folder):
                    try:
                        result = execute(root/'js/python-runner.py', code, payload)
                        need(not result['error'], str(result['error']))
                        need(normalize(result['stdout']) == normalize(expected), f'ожидалось {expected!r}, получено {result["stdout"][:200]!r}')
                        count += 1
                    except (ValueError, KeyError, OSError, subprocess.TimeoutExpired) as err:
                        failures.append(f'{tid}: {err}')
                need(not failures, '; '.join(failures))
                n += 1; g += gaps; t += count
                print(f'OK {entry["id"]}: {gaps} фрагментов, {count} тестов')
            except (ValueError, OSError, SyntaxError, tokenize.TokenError, KeyError, TypeError) as err:
                label = entry.get('id', '?') if isinstance(entry, dict) else '?'
                errors.append(f'{label}: {err}')
    configs = {p.parent.relative_to(root/'data').as_posix() for p in (root/'data').rglob('config.json')}
    unlisted = configs - paths
    if unlisted: errors.append('Нет в каталоге: ' + ', '.join(sorted(unlisted)))
    if errors:
        for error in errors: print('ОШИБКА:', error, file=sys.stderr)
        return 1
    print(f'OK: {n} шаблона, {g} размеченных фрагментов, {t} фиксированных тестов (CPython).')
    return 0

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--run-one':
        import importlib.util
        spec = importlib.util.spec_from_file_location('runner', sys.argv[2]); module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        print(module.run_test(sys.stdin.read()))
    else:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('--root', type=Path, default=ROOT, help='Корень проекта')
        args = parser.parse_args()
        try: sys.exit(validate(args.root.resolve()))
        except (ValueError, OSError, KeyError, TypeError) as error:
            print('ОШИБКА:', error, file=sys.stderr); sys.exit(1)
