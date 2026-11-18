// Запуск из корня проекта: node --experimental-default-type=module tools/test-generator.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateExercise, significantTokens } from '../js/generator.js';
const read = path => readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8');
const catalog = JSON.parse(read('catalog.json'));
let seed = 20261118;
const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
let runs = 0;
const starter = new Set(['13-01','24-02','24-08']);
for (const task of catalog.tasks) for (const template of task.templates) {
  const source = read(`${template.path}/template.py`).replace(/\r\n?/g, '\n');
  const config = JSON.parse(read(`${template.path}/config.json`));
  for (const level of [15, 30, 50, 75, 100]) {
    const variants = new Set();
    let min = 100, max = 0;
    for (let i = 0; i < 300; i++) {
      const exercise = generateExercise(source, config, level, random);
      runs++;
      variants.add(exercise.text);
      min = Math.min(min, exercise.actualPercent); max = Math.max(max, exercise.actualPercent);
      if (level === 100) { assert.equal(exercise.text, ''); assert.equal(exercise.gaps.length, 0); continue; }
      assert.ok(exercise.gaps.length > 0);
      let previous = -1, restored = exercise.text;
      for (const gap of exercise.gaps) {
        assert.ok(gap.from > previous); assert.ok(gap.to > gap.from);
        previous = gap.to;
        assert.equal(exercise.text.slice(gap.from, gap.to), gap.marker);
        const original = config.gaps.find(g => g.id === gap.id);
        assert.ok(original.levels.includes(level));
        assert.equal(gap.original, Array.from(source).slice(original.start, original.end).join(''));
      }
      for (const gap of [...exercise.gaps].reverse()) restored = restored.slice(0,gap.from) + gap.original + restored.slice(gap.to);
      assert.equal(restored, source);
      assert.equal(exercise.removedTokens, exercise.gaps.reduce((sum,g) => sum + significantTokens(g.original).length, 0));
      if (starter.has(template.id)) assert.ok(Math.abs(exercise.actualPercent-level) <= 4, 'Отклонение более 4 п.п. для исходного набора');
    }
    if (level!==100 && starter.has(template.id)) assert.ok(variants.size > 1, 'Нет вариативности в текущем наборе');
    console.log(`${template.id} ${level}%: ${variants.size} вариантов, ${min.toFixed(1)}–${max.toFixed(1)}%`);
  }
}
assert.equal(significantTokens('x = "A # B" # comment\n  x += 1').length, 6);
assert.throws(() => generateExercise('print(1)', {gaps:[{id:'broken',start:1,end:4,levels:[15],kind:'element'}]}, 15, random));
console.log(`OK — ${runs} генераций`);
