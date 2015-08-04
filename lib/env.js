/**
 * Created by tdzl2_000 on 2015-08-04.
 */
"use strict";

var wrapPromise = require("wrap-promise");
var lockFile = require("lockfile");
var os = require("os");
var co = require("co");
var path = require("path");
var fs = require("fs");

class Env
{
    constructor(options){
        this.options = options;
        let homeDir = options.home;
        if (homeDir && homeDir[0] == '~'){
            homeDir = path.normalize(path.join(os.homedir(), homeDir.substr(1)));
        }

        this.homeDir = homeDir;
        // TODO: read from cli arguments.
        this.pidFn = path.join(homeDir, '.pid');
        this.logFn = path.join(homeDir, 'maid.log');
        this.errFn = path.join(homeDir, 'error.log');

        this.port = 7744;
    }
    ensureHomeDir(){
        return co((function * (self){
            var exists = yield new Promise(function(resolver){
                fs.exists(self.homeDir, resolver);
            });
            if (!exists){
                console.log("Making home dir");
                yield wrapPromise(function(cb){
                    fs.mkdir(self.homeDir, cb);
                })
            }
        })(this));
    }
    lockPidFile(){
        var self = this;
        return wrapPromise(function(cb){
                lockFile.lock(self.pidFn+".lock", cb);
            });
    }
    unlockPidFile(){
        var self = this;
        return wrapPromise(function(cb){
            lockFile.unlock(self.pidFn+".lock", cb);
        })
    }
    lockPidFileWithGenerator(fn){
        return co((function*(self){
            yield self.lockPidFile();
            try{
                let ret = yield * fn;
                return ret;
            } finally{
                yield self.unlockPidFile();
            }
        })(this));
    }
}

module.exports = Env;
