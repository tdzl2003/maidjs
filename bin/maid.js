#!/usr/bin/env babel-node
"use strict";

if (require.main !== module){
    throw new Error("This file should be run from cli.");
}

var cliArgv = require("cli-arguments");
var path = require("path");
var os = require("os");
var co = require("co");
var argvJson = require("./maid-argv.json");
var options, command, args;
try{
    options = cliArgv.parse(argvJson);
    command = options.command;
    args = options.args;
    options = options.options;
} catch (e){
    console.error(e.stack);
    command = "help";
    args = [];
    options = {};
}


var Client = require("../lib/client");

if (command == 'help') {
    cliArgv.displayHelp(argvJson, args[0]);
} else if (command == 'start') {
    co(new Client(options).startServer())
        .catch( e =>{
            console.log(e.stack);
        });
} else if (command == 'status'){
    co(new Client(options).getStatus())
        .then(status => {
            if (status.running){
                if (status.notResponding){
                    console.log('status: running[not-responding]');
                } else {
                    console.log('status: running')
                }
            } else {
                console.log('status: stopped');
            }
        }).catch(function(e){
            console.error(e.stack);
        });
} else if (command == 'daemon'){
    let Server = require("../lib/server");
    co(new Server(options).start())
        .catch(e => {
            console.error(e.stack);
        });;
}
