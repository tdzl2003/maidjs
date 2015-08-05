"use strict";

var fs = require("fs");
var process = require("process");
var child_process = require('child_process')
var net = require("net");
var path = require("path");

var Env = require("./env.js");

class Client extends Env
{
    constructor(options){
        super(options);
    }
    *getPid(){
        try {
            let strPid = yield cb => fs.readFile(this.pidFn, cb);
            let pid = parseInt(strPid);
            process.kill(pid, 0);
            return pid;
        } catch (e) {
            try {
                yield cb=>fs.unlink(this.pidFn, cb);
            } catch(e){
            }
        }
    }
    *getStatus(){
        yield * this.ensureHomeDir();
        return yield * this.withLockPidFile(this._getStatus());
    }
    *_getStatus(){
        let pid = yield * this.getPid();
        if (undefined == pid){
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
        let out = yield cb => fs.open(this.logFn, 'a', cb);
        let err = yield cb => fs.open(this.errFn, 'a', cb);

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
    *stopServer(){
        let pid = yield * this.getPid();
        if (!pid){
            console.log("Maid daemon is not running.")
            return;
        }
        console.log("Sending SIGINT to "+pid);
        //TODO: use "stop" command instead to stop gracefully.
        process.kill(pid, "SIGINT");

        // Waiting process to exit.
        for (let tryCount =0; ; ++tryCount){
            if (tryCount > 100){
                throw new Error("Failed to stop maid daemon. try `maid kill` to kill non-responding maid daemon.");
            }
            try{
                process.kill(pid, 0);
            } catch(e){
                // process exited.
                break;
            }
            yield cb=>setTimeout(()=>cb(), 100);
        }

        // Work around on windows.
        yield cb=>fs.unlink(this.pidFn, cb);
    }
}

module.exports = Client;