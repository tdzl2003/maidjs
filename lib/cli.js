/**
 * Created by tdzl2_000 on 2015-08-05.
 */
"use strict";

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
        .catch( e => {
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
    var Server = require("../lib/server");
    var server = new Server(options);
    co(server.start())
        .catch(e => {
            server.stopSync();
            console.error(e.stack);
        });;
} else if (command == 'stop'){
    co(new Client(options).stopServer())
        .catch( e => {
            console.log(e.stack);
        });
} else if (command == 'shell'){
    co(new Client(options).openShell())
        .catch( e => {
            console.log(e.stack);
            process.exit();
        }).then(()=>{
            console.log("\nBye.");
            process.exit();
        })
}