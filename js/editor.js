/* Обёртка CodeMirror. API не зависит от конкретного шаблона и генератора. */
const compare = (a, b) => a.line - b.line || a.ch - b.ch;

export function createPythonEditor(host, { text, gaps, locked, onChange, onBlocked, onCursor, onHistory, onGap }) {
  if (!window.CodeMirror) throw new Error('Редактор не загрузился');
  const cm = window.CodeMirror(host, {
    value: text, mode: { name: 'python', version: 3 }, theme: 'codege',
    lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
    smartIndent: true, autoCloseBrackets: true, matchBrackets: true,
    autofocus: false, lineWrapping: false, inputStyle: 'textarea',
    spellcheck: false, autocorrect: false, autocapitalize: false,
    extraKeys: {
      Tab: editor => editor.somethingSelected() ? editor.indentSelection('add') : editor.replaceSelection(' '.repeat(4 - editor.getCursor().ch % 4), 'end', '+input'),
      'Shift-Tab': editor => editor.indentSelection('subtract')
    }
  });
  cm.getInputField().setAttribute('aria-label', 'Код программы на Python');
  const markers = [];
  if (locked) {
    let end = 0;
    cm.operation(() => {
      for (const gap of gaps) {
        if (gap.from > end) cm.markText(cm.posFromIndex(end), cm.posFromIndex(gap.from), { readOnly: true, className: 'fixed-code', inclusiveLeft: end === 0, inclusiveRight: false });
        markers.push(cm.markText(cm.posFromIndex(gap.from), cm.posFromIndex(gap.to), { className: 'editable-gap', inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }));
        end = gap.to;
      }
      if (end < text.length) cm.markText(cm.posFromIndex(end), cm.posFromIndex(text.length), { readOnly: true, className: 'fixed-code', inclusiveLeft: false, inclusiveRight: true });
    });
    // Защита в дополнение к readOnly: запрещаем смешанные выделения целиком.
    cm.on('beforeChange', (_, change) => {
      if (['undo','redo'].includes(change.origin)) return;
      const allowed = markers.some(marker => {
        const range = marker.find();
        return range && compare(change.from, range.from) >= 0 && compare(change.to, range.to) <= 0;
      });
      if (!allowed) { change.cancel(); onBlocked?.(); }
    });
  }
  if (!locked) {
    cm.operation(() => {
      for (const gap of gaps) markers.push(cm.markText(cm.posFromIndex(gap.from), cm.posFromIndex(gap.to), { className: 'editable-gap', inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }));
    });
  }
  let currentGap = 0;
  cm.clearHistory();
  if (gaps.length) cm.setSelection(cm.posFromIndex(gaps[0].from), cm.posFromIndex(gaps[0].to));
  const reportHistory = () => onHistory?.(cm.historySize());
  cm.on('change', () => { onChange?.(cm.getValue()); reportHistory(); });
  function reportCursor() {
    const from = cm.getCursor('from'), to = cm.getCursor('to');
    onCursor?.(cm.getCursor());
    const hit = markers.findIndex(marker => {
      const r = marker.find();
      return r && compare(from, r.from) >= 0 && compare(to, r.to) <= 0;
    });
    if (hit >= 0) onGap?.(gaps[hit].id);
  }
  cm.on('cursorActivity', reportCursor);
  reportHistory(); onCursor?.(cm.getCursor());
  let errorLine = null;
  return {
    getCode: () => cm.getValue(),
    setReadOnly: value => cm.setOption('readOnly', Boolean(value)),
    historySize: () => cm.historySize(),
    isDirty: () => cm.getValue() !== text,
    undo: () => { cm.undo(); cm.focus(); reportHistory(); },
    redo: () => { cm.redo(); cm.focus(); reportHistory(); },
    refresh: () => cm.refresh(),
    indent(direction) {
      if (cm.getOption('readOnly')) return;
      if (direction === 'add' && !cm.somethingSelected()) {
        cm.replaceSelection(' '.repeat(4 - cm.getCursor().ch % 4), 'end', '+input');
      } else cm.indentSelection(direction);
      cm.focus(); reportHistory();
    },
    insertSymbol(symbol) {
      if (cm.getOption('readOnly') || typeof symbol !== 'string' || !symbol.length) return;
      // Используем стандартную транзакцию CodeMirror: beforeChange защищает шаблон.
      // Клавиши символов вставляют буквальный текст, включая закрывающие скобки.
      cm.replaceSelection(symbol, 'end', '+input');
      cm.focus(); reportHistory();
    },
    nextGap: () => {
      // Если курсор стоит в одном из полей, переходим к следующему по порядку.
      const pos = cm.getCursor('from');
      const hit = markers.findIndex(marker => { const r = marker.find(); return r && compare(pos, r.from) >= 0 && compare(pos, r.to) <= 0; });
      if (hit >= 0) currentGap = hit;
      for (let i = 0; i < markers.length; i++) {
        currentGap = (currentGap + 1) % markers.length;
        const range = markers[currentGap].find();
        if (range) { cm.setSelection(range.from, range.to); cm.focus(); break; }
      }
    },
    selectGap(id) {
      const index = gaps.findIndex(g => g.id === id);
      const range = markers[index]?.find();
      if (range) { currentGap = index; cm.setSelection(range.from, range.to); cm.scrollIntoView(range.from); }
    },
    focus: () => cm.focus(),
    setErrorLine(line) {
      if (errorLine) cm.removeLineClass(errorLine, 'background', 'error-line');
      errorLine = Number.isInteger(line) && line >= 1 && line <= cm.lineCount() ? cm.getLineHandle(line - 1) : null;
      if (errorLine) cm.addLineClass(errorLine, 'background', 'error-line');
    }
  };
}
