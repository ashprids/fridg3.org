#!/usr/bin/env node

import fs from 'node:fs';
import vm from 'node:vm';

const markupFiles = process.argv.slice(2);

const javascriptTypes = new Set([
  '',
  'application/ecmascript',
  'application/javascript',
  'module',
  'text/ecmascript',
  'text/javascript',
]);

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodePhpStringEscapes(value, filePath) {
  if (!filePath.endsWith('.php')) {
    return value;
  }

  return value
    .replace(/\\\\/g, '\\')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function checkSyntax(source, filename) {
  new vm.Script(source, { filename });
}

function lintInlineScripts(filePath, html) {
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const attributes = match[1] ?? '';
    const scriptBody = decodePhpStringEscapes(match[2] ?? '', filePath);
    const srcMatch = attributes.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (srcMatch) {
      continue;
    }

    const typeMatch = attributes.match(/\btype\s*=\s*("([^"]*)"|'([^']*)')/i);
    const scriptType = (typeMatch?.[2] ?? typeMatch?.[3] ?? '').trim().toLowerCase();
    if (!javascriptTypes.has(scriptType)) {
      continue;
    }

    if (!scriptBody.trim()) {
      continue;
    }

    const lineNumber = getLineNumber(html, match.index ?? 0);
    checkSyntax(scriptBody, `${filePath}:${lineNumber} <script>`);
  }
}

function lintEventHandlers(filePath, html) {
  const handlerRegex = /\s(on[a-z]+)\s*=\s*("([\s\S]*?)"|'([\s\S]*?)')/gi;

  for (const match of html.matchAll(handlerRegex)) {
    const attributeName = match[1];
    const rawCode = match[3] ?? match[4] ?? '';
    const code = decodePhpStringEscapes(decodeHtmlEntities(rawCode), filePath).trim();
    if (!code) {
      continue;
    }

    const lineNumber = getLineNumber(html, match.index ?? 0);
    checkSyntax(`(function(event) {\n${code}\n});`, `${filePath}:${lineNumber} ${attributeName}`);
  }
}

let lintedFileCount = 0;

for (const filePath of markupFiles) {
  const markup = fs.readFileSync(filePath, 'utf8');
  lintInlineScripts(filePath, markup);
  lintEventHandlers(filePath, markup);
  lintedFileCount += 1;
}

console.log(`Markup JavaScript lint passed for ${lintedFileCount} files.`);
