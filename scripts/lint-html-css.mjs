#!/usr/bin/env node

import fs from 'node:fs';
import { checkCssSyntax } from './check-css-syntax.mjs';

const markupFiles = process.argv.slice(2);

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

function lintStyleBlocks(filePath, html) {
  const styleRegex = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;

  for (const match of html.matchAll(styleRegex)) {
    const attributes = match[1] ?? '';
    const styleBody = decodePhpStringEscapes(match[2] ?? '', filePath);
    const typeMatch = attributes.match(/\btype\s*=\s*("([^"]*)"|'([^']*)')/i);
    const styleType = (typeMatch?.[2] ?? typeMatch?.[3] ?? '').trim().toLowerCase();

    if (styleType && styleType !== 'text/css') {
      continue;
    }

    if (!styleBody.trim()) {
      continue;
    }

    const lineNumber = getLineNumber(html, match.index ?? 0);
    checkCssSyntax(styleBody, `${filePath}:${lineNumber} <style>`);
  }
}

function lintStyleAttributes(filePath, html) {
  const styleAttrRegex = /\sstyle\s*=\s*("([\s\S]*?)"|'([\s\S]*?)')/gi;

  for (const match of html.matchAll(styleAttrRegex)) {
    const rawCss = match[2] ?? match[3] ?? '';
    const css = decodePhpStringEscapes(decodeHtmlEntities(rawCss), filePath).trim();
    if (!css) {
      continue;
    }

    const lineNumber = getLineNumber(html, match.index ?? 0);
    checkCssSyntax(`:root { ${css} }`, `${filePath}:${lineNumber} style=""`);
  }
}

let lintedFileCount = 0;

for (const filePath of markupFiles) {
  const markup = fs.readFileSync(filePath, 'utf8');
  lintStyleBlocks(filePath, markup);
  lintStyleAttributes(filePath, markup);
  lintedFileCount += 1;
}

console.log(`Markup CSS lint passed for ${lintedFileCount} files.`);
