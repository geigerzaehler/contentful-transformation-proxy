#!/bin/bash
export PATH="$(pwd)/node_modules/.bin:$PATH"

if [[ -z "$DISPATCHER_ID" ]]; then
  export DISPATCHER_ID="3ZV1dw0NV6GakwKMSm86M4"
  export TRANSFORM_SPACE="z6k25zyp5quy"
  export TRANSFORM_SPACE_KEY="8657e474c6fa29e74356518ef72e8b119260cfb60d281cea2270fdaa5da0f629"
  # Preview key
  export TRANSFORM_SPACE_KEY="c87f772e29a66ec9a96b23e9616d16088914603b24f76d04bd667cae93c5bb80"
fi

nodemon --exec babel-node -- index.js
