/* Лёгкая лексическая подсветка учебного Python. Не выполняет и не проверяет код. */
const keywords = new Set(('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield').split(' '));
const builtins = new Set(('abs all any bin bool chr dict enumerate filter float format frozenset input int len list map max min next oct open ord pow print range repr reversed round set sorted str sum tuple type zip').split(' '));
const stringStart = /^(?:(?:fr|rf|br|rb|f|r|b|u))?("""|'''|"|')/i;
const number = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?)[jJ]?/;
const identifier = /^[\p{L}_][\p{L}\p{N}_]*/u;
const operator = /^(?:\*\*|\/\/|==|!=|<=|>=|:=|<<|>>|->|[+*/%<>=!&|^~:-])/;

function appendToken(parent, text, kind) {
  if (!text) return;
  if (!kind) { parent.append(document.createTextNode(text)); return; }
  const span = document.createElement('span');
  span.className = `py-${kind}`;
  span.textContent = text;
  parent.append(span);
}

// Ищем конец строкового литерала с учётом экранированных кавычек.
function endOfString(text, start, delimiter) {
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text.startsWith(delimiter, i)) return i + delimiter.length;
  }
  return -1;
}

export function highlightPythonLine(line, state = { delimiter: null }) {
  const fragment = document.createDocumentFragment();
  let i = 0;
  if (state.delimiter) {
    const end = endOfString(line, 0, state.delimiter);
    if (end === -1) { appendToken(fragment, line, 'string'); return fragment; }
    appendToken(fragment, line.slice(0, end), 'string');
    state.delimiter = null;
    i = end;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest[0] === '#') { appendToken(fragment, rest, 'comment'); break; }
    const string = rest.match(stringStart);
    if (string) {
      const delimiter = string[1];
      const end = endOfString(line, i + string[0].length, delimiter);
      if (end === -1) {
        appendToken(fragment, rest, 'string');
        if (delimiter.length === 3) state.delimiter = delimiter;
        break;
      }
      appendToken(fragment, line.slice(i, end), 'string');
      i = end;
      continue;
    }
    const numeric = rest.match(number);
    if (numeric) { appendToken(fragment, numeric[0], 'number'); i += numeric[0].length; continue; }
    const word = rest.match(identifier);
    if (word) {
      const value = word[0];
      const kind = keywords.has(value) ? 'keyword' : builtins.has(value) ? 'builtin' : '';
      appendToken(fragment, value, kind); i += value.length; continue;
    }
    const op = rest.match(operator);
    if (op) { appendToken(fragment, op[0], 'operator'); i += op[0].length; continue; }
    appendToken(fragment, line[i], ''); i++;
  }
  return fragment;
}
