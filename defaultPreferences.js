/*global brackets, define */

define(function (require, exports, module) {
    "use strict";

    // Default preferences are different for platforms
    var defaultPreferences = {
        "panelEnabled":                     true,
        // these are set by platform
        "flake8IsInSystemPath":               null,
        "flake8Path":                         null,
        "msysflake8Path":                     null
    };

    defaultPreferences.flake8IsInSystemPath = true;
    defaultPreferences.flake8Path           = "/usr/bin/flake8";

    module.exports = defaultPreferences;
});
