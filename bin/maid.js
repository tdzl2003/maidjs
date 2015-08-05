#!/usr/bin/env node

require("babel/register")({
    "ignore": false,
    "whitelist": [
        "es6.arrowFunctions",
        "es6.destructuring"
    ]
})

require("../lib/cli");
