/**
 * Created by tdzl2_000 on 2015-08-04.
 */
"use strict";

var process = require("process");
var co = require("co");
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

class Session {
    constructor(){
        this._config = {};
    }
    get(key){
        return this._config[key];
    }
    set(key, val){
        this._config[key] = val;
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
        this.server = new gritServer({
            readerTransformers: [
                require("grit/readers/stream-reader"),
                require("grit/readers/packetn").PacketNLE.wrap(4, 8192),
                require("grit/readers/utfstring")
            ],
            writerTransformers: [
                require("grit/writers/stream-writer").wrap(1<<20),
                require("grit/writers/packetn").PacketNLE.wrap(4),
                require("grit/writers/trunk-stream")
            ],
            looper: require("grit/loopers/rpc1by1"),
            sessionFactory: ()=>new Session(),
            process: (sess, req, cb)=>this.process(sess, req, cb)
        });
        yield * this.ensureHomeDir();
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
    process(sess, req, write){
        return co(this._process(sess, req, write));
    }
    *_process(sess, req, write){
        var out = yield write();

        let options, command, args;

        try {
            options = cliArgv.parse(shellJson, req);
            command = options.command;
            args = options.args;
            options = options.options;
        } catch (e){
            out.write("Type 'help' to get help of maid shell.\n");
            yield cb=>out.end(e.stack, cb);
            return;
        }

        try{
            yield * this[command](options, args, out, sess);
        } catch (e){
            try {
                out.write("Internal error.\n");
                yield cb=>out.end(e.stack, cb);
            } catch (e){
                // out may be ended. ignore and continue.
            }
            return;
        } finally {
            out.end();
        }
    }
    *hello(options, args, out, session){
        out.end("hello");
    }
    *help(options, args, out, session){
        cliArgv.displayHelp(shellJson, args[0], out);
        yield cb=>out.end(cb);
    }
    *set(options, args, out, session){
        console.log(args, session);
        session.set(args[0], args[1] || "");
        yield cb=>out.end(cb);
        console.log(args, session);
    }
    *get(options, args, out, session){
        console.log(args, session);
        out.write(session.get(args[0]) || "");
        yield cb=>out.end(cb);
        console.log(args, session);
    }
}

module.exports = Server;