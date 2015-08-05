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

process.on('SIGINT', function(){
    if (serverInstance && serverInstance.havePid){
        serverInstance.stop();
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
            originStdoutWrite.call(this, chunk, encoding, ()=>{
                fs.write(3, chunk, encoding, next);
            });
        }
        originStderrWrite = process.stderr.write;
        process.stderr.write = function(chunk, encoding, next) {
            originStdoutWrite.call(this, chunk, encoding,()=> {
                fs.write(3, chunk, encoding, next);
            });
        }
    } catch(e){
        //console.error(e.stack);
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
        this.server = net.createServer(function(c){
            this.onConnection(c);
        })
        yield * this.withLockPidFile(this._start(this.server));
    }
    *_start(server){
        try {
            openParentPipe();

            // listen
            yield new Promise((resolver, reject) =>{
                server.on('error', function () {
                    reject(e);
                })
                server.listen(this.port, "localhost", resolver);
            })
            console.log("Server listening on port " + this.port);

            // write pid file
            yield wrapPromise( cb =>fs.writeFile(this.pidFn, "" + process.pid, {flag: "wx"}, cb) );
            this.havePid = true;
            console.log("Server started successfully.");
        } finally{
            closeParentPipe();
        }
    }
    stop(){
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
    onConnection(c){

    }
}

module.exports = Server;