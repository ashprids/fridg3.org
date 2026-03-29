#!/usr/bin/env node

export function checkCssSyntax(source, filename) {
  const stack = [];
  let inComment = false;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let line = 1;
  let commentLine = 1;
  let stringLine = 1;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1] ?? '';

    if (char === '\n') {
      line += 1;
    }

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      commentLine = line;
      i += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      stringLine = line;
      continue;
    }

    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line });
      continue;
    }

    if (char === '}' || char === ')' || char === ']') {
      const expectedOpening = char === '}' ? '{' : char === ')' ? '(' : '[';
      const top = stack.pop();

      if (!top || top.char !== expectedOpening) {
        throw new Error(`${filename}:${line}: unexpected '${char}'`);
      }
    }
  }

  if (inComment) {
    throw new Error(`${filename}:${commentLine}: unclosed CSS comment`);
  }

  if (inString) {
    throw new Error(`${filename}:${stringLine}: unclosed CSS string`);
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new Error(`${filename}:${unclosed.line}: unclosed '${unclosed.char}'`);
  }
}
