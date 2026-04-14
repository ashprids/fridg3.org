#!/usr/bin/env node

import fs from 'node:fs';
import { checkCssSyntax } from './check-css-syntax.mjs';

const cssFiles = process.argv.slice(2);

for (const filePath of cssFiles) {
  checkCssSyntax(fs.readFileSync(filePath, 'utf8'), filePath);
}

console.log(`CSS lint passed for ${cssFiles.length} files.`);
