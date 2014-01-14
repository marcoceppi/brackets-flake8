/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, Mustache */

/** Python flake8 Extension
    Enables the flake8 lint to python documents
    Based on brackets-todo extension
    Author: Tiago Natel de Moura
*/
define(function (require, exports, module) {
    'use strict';

    var CommandManager      = brackets.getModule("command/CommandManager"),
        Menus               = brackets.getModule("command/Menus"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        NativeApp           = brackets.getModule("utils/NativeApp"),
        Commands            = brackets.getModule("command/Commands"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        Resizer             = brackets.getModule('utils/Resizer'),
        PanelManager        = brackets.getModule("view/PanelManager"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        DefaultPreferences  = require("./defaultPreferences");

    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        nodeConnection;

    var COMMAND_ID          = "python-flake8.run";
    var MENU_NAME           = "FLAKE8 Lint";

    // Mustache templates.
    var flake8PanelTemplate   = require('text!html/panel.html'),
        flake8ResultsTemplate = require('text!html/results.html'),
        flake8RowTemplate     = require('text!html/row.html'),
        $flake8Panel,
        $flake8Icon           = $('<a href="#" title="Todo" id="brackets-flake8-icon"></a>');

    // Load stylesheet.
    ExtensionUtils.loadStyleSheet(module, 'flake8.css');

    // Initialize PreferenceStorage.
    var preferences = PreferencesManager.getPreferenceStorage(module, DefaultPreferences);

    function getPEP8Binary() {
        if (preferences.getValue("flake8IsInSystemPath")) {
            return "flake8";
        } else {
            return preferences.getValue("flake8Path");
        }
    }

    function _flake8(document) {
        var currentDoc = document;
        var currentFile = currentDoc.file.fullPath;

        nodeConnection.domains.flake8.flake8(getPEP8Binary(),
                                         currentFile)
            .fail(function (err) {
                console.log("[brackets-flake8] error running file: " + currentFile + " message: " + err.toString());
                var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "FLAKE8 Error",
                    "Error when executing flake8 lint: " + err.toString()
                );
            }).done(function (ret) {
                /* nothing for now */
            });
    }

    function showPEP8() {
        Resizer.show($flake8Panel);
        $flake8Icon.addClass("active");
    }

    function hidePEP8() {
        Resizer.hide($flake8Panel);
        $flake8Icon.removeClass("active");
    }

    function checkPython(document) {
        return document.language.getId() === "python";
    }

    function denyPEP8Message() {
        var dlg = Dialogs.showModalDialog(
            Dialogs.DIALOG_ID_ERROR,
            "FLAKE8 Error",
            "FLAKE8 Lint is only for python code"
        );
    }

    function enablePEP8(enable) {
        CommandManager.get(COMMAND_ID).setChecked(enable);

        if (enable) {
            showPEP8();
        } else {
            hidePEP8();
            return;
        }

        return _flake8(DocumentManager.getCurrentDocument());
    }

    function flake8() {
        if (checkPython(DocumentManager.getCurrentDocument())) {
            return enablePEP8(CommandManager.get(COMMAND_ID).getChecked() !== true);
        } else {
            denyPEP8Message();
        }
    }

    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }

    AppInit.appReady(function () {
        nodeConnection = new NodeConnection();
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            connectionPromise.fail(function () {
                console.error("[brackets-flake8] failed to connect to node");
            });

            return connectionPromise;
        }

        function loadNodePEP8Exec() {
            var path = ExtensionUtils.getModulePath(module, "NodeFLAKE8Exec");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-flake8] failed to load flake8 domain");
            });
            return loadPromise;
        }

        var flake8HTML = Mustache.render(flake8PanelTemplate, {flake8: "/usr/local/bin/flake8"}),
            flake8Panel = PanelManager.createBottomPanel('tiago4orion.bracketsPEP8.panel', $(flake8HTML), 100);

        // Cache todo panel.
        $flake8Panel = $('#brackets-flake8');

        $flake8Panel.on('click', '.comment', function (e) {
            var $this = $(this);
            // Set cursor position at start of todo.
            EditorManager.getCurrentFullEditor().setCursorPos($this.data('line') - 1, $this.data('char'));
            // Set focus on editor.
            EditorManager.focusEditor();
        }).on('click', '.close', function () {
            enablePEP8(false);
        });

        var $documentManager = $(DocumentManager);

        $documentManager.on('documentSaved', function (event, document) {
            if (CommandManager.get(COMMAND_ID).getChecked() === true &&
                    document.language.getId() === "python") {
                _flake8(document);
            }
        }).on('currentDocumentChange', function (event) {
            var doc = DocumentManager.getCurrentDocument();
            if (!doc || !doc.language) {
                hidePEP8();
            }
            
            if (CommandManager.get(COMMAND_ID).getChecked() === true) {
                if (doc && doc.language && doc.language.getId() === "python") {
                    enablePEP8(true);
                } else {
                    hidePEP8();
                }
            }
        });

        function rowTemplate(resultObj) {
            var resultsHTML = Mustache.render(flake8RowTemplate, {
                resultObj: resultObj
            });

            return resultsHTML;
        }

        $(nodeConnection).on("flake8.update", function (evt, jsondata) {
            var resultObj = JSON.parse(jsondata),
                results = resultObj.result,
                dlg;

            if (resultObj.exitcode === 0 ||
                    results.length === 0) {
                $flake8Panel.find('.table-container').empty();
                return;
            }
            
            var resultsHTML = Mustache.render(flake8ResultsTemplate, {
                results: rowTemplate(resultObj)
            });

            resultsHTML = $(resultsHTML);

            $('.file.collapsed', resultsHTML).nextUntil('.file').hide();

            // Empty container element and apply results template.
            $flake8Panel.find('.table-container').empty().append(resultsHTML);

            Resizer.show($flake8Panel);
        });
        
        $(nodeConnection).on("flake8.error", function (evt, jsondata) {
            var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "FLAKE8 Error",
                    "flake8 not found. Run sudo pip install flake8"
                );
        });

        chain(connect, loadNodePEP8Exec);
    });

    CommandManager.register(MENU_NAME, COMMAND_ID, flake8);

    var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    menu.addMenuDivider();
    menu.addMenuItem(COMMAND_ID, [{'key': 'Ctrl-Shift-P'}]);

});
