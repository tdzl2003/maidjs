"use strict";

var fs = require("fs");
var process = require("process");
var child_process = require('child_process')
var co = require("co");
var wrapPromise = require("wrap-promise");
var net = require("net");
var path = require("path");

var Env = require("./env.js");

class Client extends Env
{
    constructor(options){
        super(options);
    }
    getStatus(){
        return co((function *(self) {
            yield self.ensureHomeDir();
            return yield self.lockPidFileWithGenerator((function *(self){
                try {
                    let strPid = yield wrapPromise(function (cb) {
                        fs.readFile(self.pidFn, cb);
                    })
                    let pid = parseInt(strPid);
                } catch(e){
                    return {
                        running: false
                    }
                }

                try{
                    process.kill(pid, 0)
                } catch (e){
                    yield wrapPromise(function(cb){
                        fs.unlink(self.pidFn, cb);
                    })
                    return {
                        running: false
                    }
                }

                let notResponding = yield new Promise(function(resolver){
                    let sock;
                    function callback(err){
                        sock && sock.destroy();
                        sock = null;
                        resolver && resolver(err);
                        resolver = null;
                    }
                    sock = net.connect(self.port, "localhost", function(){
                        callback();
                    });
                    sock.on('error', function(){
                        callback(true);
                    })
                    setTimeout(function(){
                        callback(true);
                    }, 1000);
                });

                return {
                    running: true,
                    notResponding: notResponding
                }
            })(self));
        })(this));
    }
    startServer(){
        return co((function * (self){
            var status = yield self.getStatus();
            if (status.notResponding){
                throw new Error("Maid daemon is not responding. Try `maid kill` to kill server forcelly.");
            }
            if (status.running){
                console.log("Maid is running.");
                return;
            }
            console.log("Starting maid daemon");
            let out = yield wrapPromise(function(cb) {
                fs.open(self.logFn, 'a', cb)
            });
            let err = yield wrapPromise(function(cb) {
                fs.open(self.errFn, 'a', cb)
            });
            var child = child_process.spawn(process.execPath,
                [
                    path.join(path.dirname(module.filename),"../bin/maid.js"),
                    "daemon"
                ],
                {
                    cwd: self.homeDir,
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
        })(this));
    }
}

module.exports = Client;