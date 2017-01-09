#!/bin/bash
export PATH="$(pwd)/node_modules/.bin:$PATH"

nodemon --exec babel-node -- index.js
