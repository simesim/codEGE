"""Исполнение одного учебного теста. Также проверяется обычным CPython."""
import builtins
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import traceback

MAX_OUTPUT = 32000

class OutputLimit(Exception):
    pass

class LimitedOutput(io.StringIO):
    def __init__(self):
        super().__init__()
        self.exceeded = False
        self.count = 0

    def write(self, text):
        remaining = max(0, MAX_OUTPUT - self.count)
        self.count += len(text)
        if len(text) > remaining:
            self.exceeded = True
            super().write(text[:remaining])
            raise OutputLimit('Слишком большой объём вывода')
        return super().write(text)


def run_test(payload):
    data = json.loads(payload)
    out, err = LimitedOutput(), LimitedOutput()
    error = None
    old_cwd, old_stdin = os.getcwd(), sys.stdin
    try:
        with tempfile.TemporaryDirectory(prefix='codege-') as folder:
            try:
                os.chdir(folder)
                for name, text in data['files'].items():
                    path = Path(name)
                    if path.is_absolute() or '..' in path.parts or not path.parts:
                        raise ValueError('Недопустимое имя тестового файла')
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(text.encode('utf-8'))
                namespace = {**data.get('variables', {}), '__name__': '__main__',
                             '__file__': 'main.py', '__builtins__': vars(builtins).copy()}
                sys.stdin = io.StringIO(data['stdin'])
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                    exec(compile(data['code'], 'main.py', 'exec'), namespace)
            finally:
                sys.stdin = old_stdin
                os.chdir(old_cwd)
    except BaseException as exc:
        if not (isinstance(exc, SystemExit) and (exc.code is None or exc.code == 0)):
            frames = [frame for frame in traceback.extract_tb(exc.__traceback__) if frame.filename == 'main.py']
            line = exc.lineno if isinstance(exc, SyntaxError) else (frames[-1].lineno if frames else None)
            error = {'type': type(exc).__name__, 'message': str(exc)[:2000], 'line': line}
    if out.exceeded or err.exceeded:
        error = {'type': 'OutputLimit', 'message': 'Слишком большой объём вывода', 'line': None}
    return json.dumps({'stdout': out.getvalue(), 'stderr': err.getvalue(), 'error': error}, ensure_ascii=False)
