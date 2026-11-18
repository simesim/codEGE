"""Run the offline regression checks. Requires Python 3.10+ and Node.js 22+."""
from pathlib import Path
import subprocess
import shutil
import sys

root = Path(__file__).resolve().parents[1]
node = shutil.which('node')
if not node:
    print('Для полного запуска автотестов нужен Node.js 22+. Только материалы можно проверить: python tools/validate.py', file=sys.stderr)
    sys.exit(2)
for script in ('validate.py', 'test-validator.py', 'test-python-runner.py'):
    print(f'\n--- tools/{script}', flush=True)
    subprocess.run([sys.executable, '-B', '-X', 'utf8', str(root/'tools'/script)], cwd=root, check=True)
for script in ('test-generator.mjs','test-hints.mjs','test-checker.mjs','test-progress.mjs'):
    print(f'\n--- tools/{script}', flush=True)
    subprocess.run([node, '--experimental-default-type=module', str(root/'tools'/script)], cwd=root, check=True)
print('\nOK: Все локальные автотесты пройдены. Реальный Pyodide и GitHub Pages проверяются в браузере отдельно.')
