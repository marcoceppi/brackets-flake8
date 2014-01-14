/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global exports, require */

(function () {
    "use strict";
    var process = require('child_process'),
        domainManager = null;
    var childproc = null;

    function flake8(binary, file) {
        childproc = process.exec(binary + ' "' + file + '"', function (error, stdout, stderr) {
            var result = [],
                resultObj = {
                    "exitcode": childproc.exitCode,
                    "result": [],
                    "stdout": stdout,
                    "stderr": stderr
                },
                i;

            if (childproc.exitCode === 0) {
                /* Python OK */
                domainManager.emitEvent("flake8", "update", JSON.stringify(resultObj));
                return;
            } else if (childproc.exitCode === 127) {
                domainManager.emitEvent("flake8", "error", JSON.stringify(resultObj));
                return;
            }

            var lines = stdout.split("\n");

            for (i = 0; i < lines.length; i++) {
                var line = lines[i];

                if (line !== "") {
                    var pos = line.indexOf(":");
                    var filename = line.substring(0, pos);
                    var lpos = line.indexOf(":", pos + 1);
                    var lnumber = line.substring(pos + 1, lpos);
                    var cpos = line.indexOf(":", lpos + 1);
                    var cnumber = line.substring(lpos + 1, cpos);
                    var message = line.substring(line.lastIndexOf(":") + 1);

                    result.push({
                        "filename": "lala",
                        "line": lnumber,
                        "column": cnumber,
                        "message": message,
                        "original": line
                    });
                }
            }

            resultObj.result = result;
            var resultstr = JSON.stringify(resultObj);
            domainManager.emitEvent("flake8", "update", resultstr);
        });
    }

    function init(DomainManager) {
        domainManager = DomainManager;
        if (!domainManager.hasDomain("flake8")) {
            domainManager.registerDomain("flake8", {major: 0, minor: 1});
        }

        domainManager.registerCommand(
            "flake8", /* Domain name */
            "flake8", /* Command name */
            flake8,   /* Command handler function */
            false,  /* This command is synchronous */
            "Runs flake8 lint on a file",
            ["binary", "file"], /* parameters */
            []
        );

        domainManager.registerEvent(
            "flake8",
            "update",
            ["data"]
        );
        
        domainManager.registerEvent(
            "flake8",
            "error",
            ["data"]
        );
    }

    exports.init = init;
}());
