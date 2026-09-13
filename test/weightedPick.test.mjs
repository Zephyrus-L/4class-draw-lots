import assert from 'node:assert/strict'
import { weightedPick } from '../src/weightedPick.js'

const pool = [{ id: 1, name: '李四' }, { id: 2, name: '王五' }, { id: 3, name: '赵六' }]
assert.equal(weightedPick(pool, { '0-李四': 100 }, '001', () => 0.99).name, '李四')
assert.equal(weightedPick(pool, { '0-李四': 50, '0-王五': 1 }, '001', () => 0).name, '李四')
assert.equal(weightedPick(pool, { '0-李四': 50, '0-王五': 1 }, '001', () => 0.99).name, '赵六')
assert.equal(weightedPick(pool, { '0-李四': 1, '001-王五': 100 }, '001', () => 0.99).name, '王五')

const first = weightedPick(pool, { '0-李四': 50, '0-王五': 1 }, '001', () => 0)
const remaining = pool.filter((person) => person.id !== first.id)
assert.equal(weightedPick(remaining, { '0-李四': 50, '0-王五': 1 }, '001', () => 0.99).name, '赵六')
console.log('weightedPick tests passed')
