/**
 * Created by tdzl2_000 on 2015-08-04.
 */
"use strict";

var wrapPromise = require("wrap-promise");
var lockFile = require("lockfile");
var os = require("os");
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
    *ensureHomeDir(){
        let exists = yield new Promise(resolver => fs.exists(this.homeDir, resolver));
        if (!exists){
            console.log("Making home dir");
            yield wrapPromise(cb => fs.mkdir(this.homeDir, cb));
        }
    }
    *lockPidFile(){
        yield wrapPromise(cb => lockFile.lock(this.pidFn+".lock", cb));
    }
    *unlockPidFile(){
        yield wrapPromise(cb => lockFile.unlock(this.pidFn+".lock", cb));
    }
    *withLockPidFile(fn){
        yield * this.lockPidFile();
        try{
            let ret = yield * fn;
            return ret;
        } finally{
            yield * this.unlockPidFile();
        }
    }
}

module.exports = Env;
