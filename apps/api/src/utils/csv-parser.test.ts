import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEmails } from './csv-parser.js';

test('extracts unique email addresses from mixed CSV and text', () => {
  assert.deepEqual(extractEmails('Name,email\nAda,ADA@example.com\nOther,other@example.org\nada@example.com'), ['ada@example.com','other@example.org']);
});

test('returns an empty list for text with no email addresses', () => {
  assert.deepEqual(extractEmails('a row without a recipient'), []);
});
