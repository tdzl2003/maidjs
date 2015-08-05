/**
 * Created by tdzl2_000 on 2015-08-04.
 */
"use strict";

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
            yield cb => fs.mkdir(this.homeDir, cb);
        }
    }
    *lockPidFile(){
        yield cb => lockFile.lock(this.pidFn+".lock", cb);
    }
    *unlockPidFile(){
        yield cb => lockFile.unlock(this.pidFn+".lock", cb);
    }
    *withLockPidFile(fn){
        yield * this.lockPidFile();
        try{
            return yield * fn;
        } finally{
            yield * this.unlockPidFile();
        }
    }
    lockPidFileSync(){
        lockFile.lockSync(this.pidFn+".lock");
    }
    unlockPidFileSync(){
        lockFile.unlockSync(this.pidFn+".lock");
    }
    withLockSync(fn){
        this.lockPidFileSync();
        try{
            return fn();
        } finally{
            this.unlockPidFileSync();
        }
    }
}

module.exports = Env;
