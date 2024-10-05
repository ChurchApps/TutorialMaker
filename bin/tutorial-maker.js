#!/usr/bin/env node

const path = require('path');

// Get the path to the index.js file
const scriptPath = path.join(__dirname, 'index.js');

// Run the index.js script with all the provided arguments
require(scriptPath);
