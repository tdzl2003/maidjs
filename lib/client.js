"use strict";

var fs = require("fs");
var process = require("process");
var child_process = require('child_process')
var wrapPromise = require("wrap-promise");
var net = require("net");
var path = require("path");

var Env = require("./env.js");

class Client extends Env
{
    constructor(options){
        super(options);
    }
    *getStatus(){
        yield * this.ensureHomeDir();
        return yield * this.withLockPidFile(this._getStatus());
    }
    *_getStatus(){
        try {
            let strPid = yield wrapPromise(cb => fs.readFile(this.pidFn, cb));
            let pid = parseInt(strPid);
            process.kill(pid, 0);
        } catch (e) {
            try {
                yield wrapPromise(cb=>fs.unlink(this.pidFn, cb));
            } catch(e){
            }
            return {
                running: false
            }
        }

        let notResponding = yield new Promise(resolver => {
            let sock;

            function callback(err) {
                sock && sock.destroy();
                sock = null;
                resolver && resolver(err);
                resolver = null;
            }

            sock = net.connect(this.port, "localhost", function () {
                callback();
            });
            sock.on('error', function () {
                callback(true);
            })
            setTimeout(function () {
                callback(true);
            }, 1000);
        });

        return {
                running: true,
                notResponding: notResponding
            };
    }
    *startServer(){
        let status = yield * this.getStatus();
        if (status.notResponding){
            throw new Error("Maid daemon is not responding. Try `maid kill` to kill server forcelly.");
        }
        if (status.running){
            console.log("Maid is running.");
            return;
        }
        console.log("Starting maid daemon");
        let out = yield wrapPromise(cb => fs.open(this.logFn, 'a', cb));
        let err = yield wrapPromise(cb => fs.open(this.errFn, 'a', cb));

        let child = child_process.spawn(process.execPath,
            [
                path.join(path.dirname(module.filename),"../bin/maid.js"),
                "daemon"
            ],
            {
                cwd: this.homeDir,
                detached: true,
                stdio: ['ignore', out, err, "pipe"]
            });
        console.log("(Message from daemon process)");
        child.stdio[3].pipe(process.stdout);
        yield new Promise(function(resolver){
            child.stdio[3].on('end', function(){
                resolver();
                child.unref();
            })
            child.on('exit', function(){
                resolver();
                child.unref();
            })
        });
    }
}

module.exports = Client;