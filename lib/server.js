/**
 * Created by tdzl2_000 on 2015-08-04.
 */
"use strict";

var process = require("process");
var fs = require("fs");
var cliArgv = require("cli-arguments");
var gritServer = require("grit/server");

var Env = require("./env.js");
var shellJson = require("./maid-shell.json");

var serverInstance;

process.on('SIGINT', function(){
    if (serverInstance){
        serverInstance.stopSync();
    }
})

//
var originStdoutWrite, originStderrWrite;
function openParentPipe(){
    try {
        fs.fstatSync(3);
        var stream = require("stream");
        originStdoutWrite = process.stdout.write;
        process.stdout.write = function(chunk, encoding, next) {
            fs.write(3, chunk, encoding,()=>{});
            originStdoutWrite.call(this, chunk, encoding, next);
        }
        originStderrWrite = process.stderr.write;
        process.stderr.write = function(chunk, encoding, next) {
            fs.write(3, chunk, encoding,()=>{});
            originStderrWrite.call(this, chunk, encoding, next);
        }
        return true;
    } catch(e){
    }
}
function closeParentPipe(){
    if (originStdoutWrite){
        fs.close(3);
        process.stdout.write = originStdoutWrite
        originStdoutWrite = null;
        process.stderr.write = originStderrWrite
        originStderrWrite = null;
    }
}

class Server extends Env
{
    constructor(options){
        super(options);
        if (serverInstance){
            throw new Error("Server instance can only be create once.");
        }
        serverInstance = this;
    }
    *start(){
        if (this.server){
            return;
        }
        this.server = new gritServer();
        yield * this.withLockPidFile(this._start(this.server));
    }
    *_start(server){
        try {
            openParentPipe();

            // listen
            yield server.listen(this.port, "localhost");

            console.log("Server listening on port " + this.port);

            // write pid file
            yield cb =>fs.writeFile(this.pidFn, "" + process.pid, {flag: "wx"}, cb);
            this.havePid = true;
            console.log("Server started successfully.");
        } finally{
            closeParentPipe();
        }
    }
    stopSync(){
        console.log("Stopping");
        this.withLockSync(()=>{
            if (this.server){
                this.server.close();
                this.server = null;
            }
            if (this.havePid){
                fs.unlinkSync(this.pidFn);
                this.havePid = false;
            }
        });
    }
    hello(){
    }
}

module.exports = Server;