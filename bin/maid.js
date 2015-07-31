#!node
"use strict";

if (require.main !== module){
    throw new Error("This file should be run from cli.");
}

var cliArgv = require("cli-arguments");
var path = require("path");
var os = require("os");
var argvJson = require("./maid-argv.json");
var options, command, args;
try{
    options = cliArgv.parse(argvJson);
    command = options.command;
    args = options.args;
    options = options.options;
} catch (e){
    options = {
        command: 'help'
    }
}

if (options.home && options.home[0] == '~'){
    options.home = path.normalize(path.join(os.homedir(), options.home.substr(1)));
}

if (command == 'help') {
    cliArgv.displayHelp(argvJson, args[0]);
} else if (command == 'start') {
    require("../lib/client").startServer();
}
