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
    *connect(timeout){
        return yield new Promise((resolver, reject) => {
            let sock;

            sock = net.connect(this.port, "localhost", function () {
                resolver(sock);
            });
            sock.on('error', function (e) {
                reject(e);
            })

            if (timeout) {
                setTimeout(function () {
                    sock.destroy();
                    reject(new Error("Timeout"));
                }, timeout);
            }
        })
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

        try {
            let sock = (yield * this.connect(1000));

            //TODO: send "bye" message instead.
            sock.destroy();

            return {
                running: true
            };
        } catch (e){
            return {
                running: true,
                notResponding: true
            };
        }
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
    *openShell(){
        var rl = require("readline").createInterface(process.stdin, process.stdout);

        let sock = (yield * this.connect());

        let forceQuit = false;
        process.on('SIGINT', function(){
            rl.close();
        })
        rl.on('close', function(){
            sock.end();
        })
        rl.setPrompt('>');

        let readerTransformers= [
                require("grit/readers/stream-reader"),
                require("grit/readers/packetn").PacketNLE.wrap(4, 8192),
                require("grit/readers/trunk-stream")
            ],
            writerTransformers= [
                require("grit/writers/stream-writer").wrap(1<<20),
                require("grit/writers/packetn").PacketNLE.wrap(4),
                require("grit/writers/utfstring")
            ];
        var reader = sock;
        for (let i = 0; i < readerTransformers.length; i++){
            reader = readerTransformers[i](reader);
        }
        var writer = sock;
        for (let i = 0; i < writerTransformers.length; i++){
            writer = writerTransformers[i](writer);
        }

        yield new Promise((resolver, reject) => {
            sock.on('error', reject);
            sock.on('close', resolver);

            rl.prompt();
            rl.on('line', function(line){
                if (!line){
                    rl.prompt();
                    return;
                }
                rl.pause();
                writer(line, ()=>{
                    var rstream = reader((err, data) => {
                        process.stdout.write('\n');
                        rl.prompt();
                        rl.resume();
                    })
                    rstream.pipe(process.stdout, {end:false});
                })
            })
        })
    }
}

module.exports = Client;