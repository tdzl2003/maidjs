/**
 * Created by tdzl2_000 on 2015-08-04.
 */
"use strict";

var net = require("net");
var process = require("process");
var wrapPromise = require("wrap-promise");
var fs = require("fs");

var Env = require("./env.js");

var serverInstance;

process.on('exit', function(){
    if (serverInstance && serverInstance.havePid){
        serverInstance.lockPidFileWithGenerator(function*(self){
            console.log("Exiting");
            yield wrapPromise(function(cb){
                fs.unlink(self.pidFn, cb);
            })
        })
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
            originStdoutWrite.call(this, chunk, encoding, next);
            fs.write(3, chunk, encoding, next);
        }
        originStderrWrite = process.stderr.write;
        process.stderr.write = function(chunk, encoding, next) {
            originStdoutWrite.call(this, chunk, encoding, next);
            fs.write(3, chunk, encoding, next);
        }
    } catch(e){
        console.error(e.stack);
    }
}
function closeParentPipe(){
    if (originStdoutWrite){
        fs.writeSync(3, "Done\n");
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
    start(){
        if (this.server){
            return;
        }
        var self = this;
        this.server = net.createServer(function(c){
            self.onConnection(c);
        })
        return this.lockPidFileWithGenerator((function*(self){
            try {
                openParentPipe();

                // listen
                yield new Promise(function (resolver, reject) {
                    var server = self.server;
                    server.on('error', function () {
                        reject(e);
                    })
                    server.listen(self.port, "localhost", resolver);
                    self.server = server;
                })
                console.log("Server listening on port " + self.port);

                // write pid file
                yield wrapPromise(function (cb) {
                    fs.writeFile(self.pidFn, "" + process.pid, {flag: "wx"}, cb);
                });
                self.havePid = true;
            } finally{
                closeParentPipe();
            }

        })(this));
    }
    onConnection(c){

    }
}

module.exports = Server;