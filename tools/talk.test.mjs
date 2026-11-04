import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const modelPath = '../assets/js/talk-model.js';

test('lecture model is available', () => {
  assert.ok(existsSync(new URL(modelPath, import.meta.url)), 'Missing lecture numerical model');
});

if (existsSync(new URL(modelPath, import.meta.url))) {
  const m = require(modelPath);
  test('main lecture lasts 30 minutes with foundations before GEMM', () => {
    assert.equal(m.stops.length, 14);
    assert.equal(m.stops.reduce((n,s) => n+s.seconds, 0), 1800);
    assert.equal(m.stops.slice(0,9).reduce((n,s) => n+s.seconds, 0), 1200);
    assert.equal(m.stops[9].id, 'gemm');
  });
  test('WHILELT drives a load that zeroes inactive lanes', () => {
    assert.deepEqual(m.predicate(2,5), [true,true,true,false]);
    assert.deepEqual(m.load([1,2,3,4],m.predicate(2,5)), [1,2,3,0]);
    assert.deepEqual(m.predicate(5,5), [false,false,false,false]);
  });
  test('FMLA merges masked destination lanes', () => {
    assert.deepEqual(m.fmla([10,10,10,10],[1,2,3,4],[2,1,3,2],[true,true,false,true]), [12,12,10,18]);
  });
  test('outer product preserves disabled rows and columns without mutating accumulator', () => {
    const acc=Array.from({length:4},()=>[10,10,10,10]);
    const result=m.outer(acc,[1,2,3,4],[2,1,3,2],[true,false,true,true],[true,true,false,true]);
    assert.deepEqual(result,[[12,11,10,12],[10,10,10,10],[16,13,10,16],[18,14,10,18]]);
    assert.deepEqual(acc,Array.from({length:4},()=>[10,10,10,10]));
  });
  test('three K updates produce the illustrated GEMM block', () => {
    assert.deepEqual(m.gemm(0),Array.from({length:4},()=>[0,0,0,0]));
    assert.deepEqual(m.gemm(1),[[2,1,3,2],[4,2,6,4],[6,3,9,6],[8,4,12,8]]);
    assert.deepEqual(m.gemm(3),[[4,6,7,3],[5,4,7,4],[6,5,13,8],[9,7,15,9]]);
  });
  test('horizontal and vertical stores preserve inactive memory elements', () => {
    const tile=[[12,11,13,12],[14,12,16,14],[16,13,19,16],[18,14,22,18]];
    assert.deepEqual(m.slice(tile,1,false),[14,12,16,14]);
    assert.deepEqual(m.slice(tile,1,true),[11,12,13,14]);
    const memory=[99,99,99,99];
    assert.deepEqual(m.store(memory,m.slice(tile,1,true),[true,false,true,true]),[11,99,13,14]);
    assert.deepEqual(memory,[99,99,99,99]);
  });
  test('roofline bounds performance by both bandwidth and peak', () => {
    assert.equal(m.roofline(128,32,1).performance,32);
    assert.equal(m.roofline(128,32,8).performance,128);
    assert.equal(m.roofline(128,32,1).ridge,4);
    assert.equal(m.roofline(128,32,1).bound,'memory');
    assert.equal(m.roofline(128,32,8).bound,'compute');
  });
  test('hashes restore known stops and legacy links safely', () => {
    assert.equal(m.resolveStop('#fmopa'),7);
    assert.equal(m.resolveStop('#unknown'),0);
    assert.equal(m.resolveStop('#kitchen'),12);
    assert.equal(m.resolveStop('#attn'),13);
    assert.equal(m.resolveStop('#0'),0);
    assert.equal(m.resolveStop('#8'),7);
    assert.equal(m.resolveStop('#10'),10);
    assert.equal(m.resolveStop('#12'),12);
    assert.equal(m.resolveStop('#16'),13);
  });
}
