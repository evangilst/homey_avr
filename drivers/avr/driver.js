"use strict";

var eventEmitter = require("events");
var Avr = require("./lib/avr");

var MAX_AVRS = 8; // Max allowed AVR configurations
var avrSvr = null; // event channel
var myDebugMode = false; // Write debug messages or not
var avrDevArray = []; // AVR device array
var newDevInfo = {}; // New device
var knownAvrs = []; // Known avr names.

/**
 * Prints debug messages using homey.log if debug is switched on.
 *
 * @param      {string}  str     The message string
 */
var prtDbg = function prtDbg(str) {
    if (myDebugMode === true) {
        var date = new Date();
        var dateStr = date.toISOString();
        Homey.log(dateStr + "-" + str);
        //console.log(`${dateStr}-${str}`);
    }
};

/**
 * Prints message unconditionally using home.log
 *
 * @param      {string}  str     The mesage string
 */
var prtMsg = function prtMsg(str) {
    var date = new Date();
    var dateStr = date.toISOString();
    Homey.log(dateStr + "-" + str);
    //console.log(`${dateStr}-${str}`);
};

/**
 * Gets the string defined in the locales files of homey.
 *
 * @param      {string}  str     The ID string
 * @return     {string}  The 'locales' string for the ID.
 */
var getI18String = function getI18String(str) {
    return Homey.manager("i18n").__(str);
};

/**
 * Switch debug mode on
 */
// let switchOnDebugMode = () => {
//     myDebugMode = true ;
//     prtDbg("Debug switched on");
// };

/**
 * Swicth debug mode off.
 */
// let switchOffDebugMode = () => {
//     prtDbg("Debug switched off");
//     myDebugMode = false ;
// };

/**
 * Set up event listeners.
 */
var setUpListeners = function setUpListeners() {

    avrSvr
    // initiation and load avr type json files events
    .on("init_success", function (num, name, type) {
        prtDbg("AVR " + name + " slot " + num + " has loaded the " + type + ".json file.");
        // the AVR type json files has been loaded.
        // enable certain functions/methods
        avrDevArray[num].confLoaded = true;
    }).on("init_failed", function (num, name, type) {
        prtMsg("Error: AVR " + name + " (slot " + num + ") has fail to load the " + type + ".json file.");
        // Cannot load / parse the AVR type json file
        // Block certain functions.methods
        // TODO:
        //    Need to set the device "unavailable" for HOMEY. (setUnavailable??)
        avrDevArray[num].confLoaded = false;
    })

    // network events.
    .on("net_connected", function (num, name) {
        prtDbg("Avr " + name + " (slot " + num + ") is connected.");
        // There is a network connection with the AVR.
        // TODO:
        //     Set the device "available" for HOMEY (setAvailable??)
        avrDevArray[num].available = true;
    }).on("net_disconnected", function (num, name) {
        prtMsg("Avr " + name + " (slot " + num + ") is disconnected.");
        // Lost the network connection with the AVR.
        // TODO:
        //     Set the device "unavailable" for HOMEY (setUnavailable??)
        avrDevArray[num].available = false;
    }).on("net_timed_out", function (num, name) {
        prtMsg("Avr " + name + " (slot " + num + ") timed out.");
        // Lost the network connection with the AVR.
        // TODO:
        //     Set the device "unavailable" for HOMEY (setUnavailable??)
        avrDevArray[num].available = false;
    }).on("net_error", function (num, name, err) {
        prtMsg("Avr " + name + " (slot " + num + ") has a network error -> " + err + ".");
        // Lost the network connection with the AVR.
        // TODO:
        //     Set the device "unavailable" for HOMEY (setUnavailable??)
        avrDevArray[num].available = false;
    }).on("net_uncaught", function (num, name, err) {
        prtMsg("Avr " + name + " (slot " + num + ") : uncaught event '" + err + "'.");
        //avrDevArray[ num ].available = false;
    })

    // Status triggers
    .on("power_status_chg", function (num, name, newcmd, oldcmd) {

        prtDbg("Avr " + name + " (slot " + num + ") : " + newcmd + " - " + oldcmd);

        if (newcmd === "power.on" && oldcmd === "power.off") {
            prtDbg("triggering t_power_on");

            Homey.manager("flow").trigger("t_power_on", { name: name }, { name: name });
        } else if (newcmd === "power.off" && oldcmd === "power.on") {
            prtDbg("triggering t_power_off");

            Homey.manager("flow").trigger("t_power_off", { name: name }, { name: name });
        }
    }).on("mute_status_chg", function (num, name, newcmd, oldcmd) {

        prtDbg("Avr " + name + " (slot " + num + ") : " + newcmd + " - " + oldcmd);

        if (newcmd === "mute.on" && oldcmd === "mute.off") {
            prtDbg("triggering t_mute_on");

            Homey.manager("flow").trigger("t_mute_on", { name: name }, { name: name });
        } else if (newcmd === "mute.off" && oldcmd === "mute.on") {
            prtDbg("triggering t_mute_off");

            Homey.manager("flow").trigger("t_mute_off", { name: name }, { name: name });
        }
    }).on("eco_status_chg", function (num, name, newcmd, oldcmd) {

        prtDbg("Avr " + name + " (slot " + num + ") : " + newcmd + " - " + oldcmd);

        if (newcmd === "eco.on" && oldcmd !== "eco.on") {
            prtDbg("triggering t_eco_on");

            Homey.manager("flow").trigger("t_eco_on", { name: name }, { name: name });
        } else if (newcmd === "eco.off" && oldcmd !== "eco.off") {
            prtDbg("triggering t_eco_off");

            Homey.manager("flow").trigger("t_eco_off", { name: name }, { name: name });
        } else if (newcmd === "eco.auto" && oldcmd !== "eco.auto") {
            prtDbg("triggering t_eco_auto");

            Homey.manager("flow").trigger("t_eco_auto", { name: name }, { name: name });
        }
    }).on("isource_status_chg", function (num, name, cmd) {
        prtDbg("Avr " + name + " (slot " + num + ") : " + cmd);
    }).on("surmode_status_chg", function (num, name, cmd) {
        prtDbg("Avr " + name + " (slot " + num + ") : " + cmd);
    }).on("volume_chg", function (num, name, value) {
        prtDbg("Avr " + name + " (slot " + num + ") changed volume to " + value + ".");
    })

    // Debug messages from ath avr control part.
    .on("debug_log", function (num, name, msg) {
        prtDbg("AVR " + name + " (slot " + num + ") " + msg + ".");
    }).on("uncaughtException", function () {
        // catch uncaught exception to prevent runtime problems.
        prtDbg("Oops: uncaught exception !.");
    });
};

/**
 * Initialize the HOMEY AVR application paramaters called after
 * startup or reboot of Homey.
 *
 * @param      Array     devices   Array with all devices info.
 * @param      Function  callback  Notify Homey we have started
 * @return     'callback'
 */
var init = function init(devices, callback) {

    if (avrSvr === null) {

        // Initialize the 2 dev arrays.
        var emptyDev = {
            dev: null,
            available: false,
            confloaded: false,
            used: false
        };

        for (var I = 0; I < MAX_AVRS; I++) {

            avrDevArray[I] = emptyDev;
        }

        avrSvr = new eventEmitter();

        setUpListeners();

        if (devices.length !== 0) {

            devices.forEach(function (device) {

                if (myDebugMode === true) {

                    prtDbg("MarantzAvr: init: '" + device.avrip + "'.");
                    prtDbg("MarantzAvr: init: '" + device.avrport + "'.");
                    prtDbg("MarantzAvr: init: '" + device.avrname + "'.");
                    prtDbg("MarantzAvr: init: '" + device.avrtype + "'.");
                    prtDbg("MarantzAvr: init: '" + device.avrindex + "'.");
                }

                var xDev = {
                    dev: new Avr(),
                    available: false,
                    confloaded: false,
                    used: true
                };

                avrDevArray[device.avrindex] = xDev;

                avrDevArray[device.avrindex].dev.init(device.avrport, device.avrip, device.avrname, device.avrtype, device.avrindex, avrSvr);
                var x = {
                    name: device.avrname,
                    avr: device.avrname
                };

                knownAvrs.push(x);
            });

            if (myDebugMode === true) {
                for (var I = 0; I < avrDevArray.length; I++) {
                    if (avrDevArray[I].used === true) {
                        var host = avrDevArray[I].dev.getHostname();
                        var port = avrDevArray[I].dev.getPort();

                        prtDbg("Entry " + I + " has " + host + ":" + port + ".");
                    } else {
                        prtDbg("Entry " + I + " is not used.");
                    }
                }
                prtDbg("KnownAvrs :");

                for (var I = 0; I < knownAvrs.length; I++) {
                    prtDbg(I + " -> " + knownAvrs[I].name + ".");
                }
            }
        }

        Homey.manager("flow").on("trigger.t_power_on.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_power_on complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_power_off.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_power_off complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_mute_on.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_mute_on complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_mute_off.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_mute_off complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_eco_on.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_eco_on complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_eco_off.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_eco_off complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_eco_auto.avrname.autocomplete", function (callback) {

            prtDbg("Trigger t_eco_auto complete called");

            callback(null, knownAvrs);
        });

        Homey.manager("flow").on("trigger.t_power_on", function (callback, args, data) {

            prtDbg("On Trigger t_power_on called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

        Homey.manager("flow").on("trigger.t_power_off", function (callback, args, data) {

            prtDbg("On Trigger t_power_off called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

        Homey.manager("flow").on("trigger.t_mute_on", function (callback, args, data) {

            prtDbg("On Trigger t_mute_on called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

        Homey.manager("flow").on("trigger.t_mute_off", function (callback, args, data) {

            prtDbg("On Trigger t_mute_off called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

        Homey.manager("flow").on("trigger.t_eco_on", function (callback, args, data) {

            prtDbg("On Trigger t_eco_on called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

        Homey.manager("flow").on("trigger.t_eco_off", function (callback, args, data) {

            prtDbg("On Trigger t_eco_off called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

        Homey.manager("flow").on("trigger.t_eco_auto", function (callback, args, data) {

            prtDbg("On Trigger t_eco_auto called");

            if (data.name === args.avrname.name) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        });
    } else {
        prtDbg("Init called for the second time!.");
    }

    callback(null, "");
};

/**
 * Homey delete request for an AVR.
 *
 * @param      Object    device    Info of the to-be-delete device
 * @param      Function  callback  Inform Homey of the result.
 * @return     'callback'
 */
var deleted = function deleted(device, callback) {

    if (myDebugMode === true) {
        prtDbg("Marantzavr: delete_device called");
        prtDbg("Marantzavr: delete_device: " + device.avrip + ".");
        prtDbg("Marantzavr: delete_device: " + device.avrport + ".");
        prtDbg("Marantzavr: delete_device: " + device.avrname + ".");
        prtDbg("Marantzavr: delete_device: " + device.avrindex + ".");
    }

    if (avrDevArray[device.avrindex].used === false) {

        callback(new Error(getI18String("error.dev_mis_del")), false);
    } else {

        avrDevArray[device.avrindex].dev.disconnect();

        for (var I = 0; I < knownAvrs.length; I++) {
            if (knownAvrs[I].name === device.avrname) {
                knownAvrs.splice(I, 1);
            }
        }

        var xDev = {
            dev: null,
            available: false,
            confloaded: false,
            used: false
        };

        avrDevArray[device.avrindex] = xDev;

        if (myDebugMode === true) {
            for (var I = 0; I < avrDevArray.length; I++) {
                if (avrDevArray[I].used === true) {
                    var host = avrDevArray[I].dev.getHostname();
                    var port = avrDevArray[I].dev.getPort();

                    prtDbg("Entry " + I + " has " + host + ":" + port + ".");
                } else {
                    prtDbg("Entry " + I + " is not used.");
                }
            }
            prtDbg("KnownAvrs :");

            for (var I = 0; I < knownAvrs.length; I++) {
                prtDbg(I + " -> " + knownAvrs[I].name + ".");
            }
        }

        callback(null, true);
    }
};

var added = function added(device, callback) {

    if (myDebugMode === true) {
        prtDbg("Marantzavr: add_device called");
        prtDbg("Marantzavr: add_device: " + device.avrip + ".");
        prtDbg("Marantzavr: add_device: " + device.avrport + ".");
        prtDbg("Marantzavr: add_device: " + device.avrname + ".");
        prtDbg("Marantzavr: add_device: " + device.avrindex + ".");
    }

    var xDev = {
        dev: new Avr(),
        available: false,
        confloaded: false,
        used: true
    };

    avrDevArray[newDevInfo.avrindex] = xDev;

    avrDevArray[newDevInfo.avrindex].dev.init(newDevInfo.avrport, newDevInfo.avrip, newDevInfo.avrname, newDevInfo.avrtype, newDevInfo.avrindex, avrSvr);

    var x = {
        name: newDevInfo.avrname,
        avr: newDevInfo.avrname
    };

    knownAvrs.push(x);

    if (myDebugMode === true) {
        prtDbg("New device array :");

        for (var I = 0; I < avrDevArray.length; I++) {
            if (avrDevArray[I].used == true) {
                var host = avrDevArray[I].dev.getHostname();
                var port = avrDevArray[I].dev.getPort();
                var used = avrDevArray[I].used;

                prtDbg("Entry " + I + " has " + host + ":" + port + " (" + used + ").");
            } else {
                prtDbg("Entry " + I + " is not used.");
            }
        }
        prtDbg("KnownAvrs :");

        for (var I = 0; I < knownAvrs.length; I++) {
            prtDbg(I + " -> " + knownAvrs[I].name + ".");
        }
    }

    newDevInfo = {};

    callback(null, true);
};

/**
 * Pair Homey with new devices.
 *
 * @method     pair
 * @param      socket  socket  communication socket
 * @return     'callback'
 */
var pair = function pair(socket) {

    socket.on("list_devices", function (data, callback) {

        if (myDebugMode === true) {

            prtDbg("MarantzAvr: pair => list_devices called.");
            prtDbg("MarantzAvr: pair => list_devices: '" + newDevInfo.avrip + "'.");
            prtDbg("MarantzAvr: pair => list_devices: '" + newDevInfo.avrport + "'.");
            prtDbg("MarantzAvr: pair => list_devices: '" + newDevInfo.avrname + "'.");
            prtDbg("MarantzAvr: pair => list_devices: '" + newDevInfo.avrtype + "'.");
            prtDbg("MarantzAvr: pair => list_devices: '" + newDevInfo.avrindex + "'.");
        }

        if (newDevInfo.avrindex === -1) {
            callback(new Error(getI18String("error.full_dev_ar")), {});
        }
        var devices = [{
            name: newDevInfo.avrname,
            data: {
                id: newDevInfo.avrname,
                avrip: newDevInfo.avrip,
                avrport: newDevInfo.avrport,
                avrname: newDevInfo.avrname,
                avrtype: newDevInfo.avrtype,
                avrindex: newDevInfo.avrindex
            }
        }];

        //newDevInfo = {};

        callback(null, devices);
    }).on("get_devices", function (data) {

        if (myDebugMode === true) {
            prtDbg("MarantzAvr: pair => get_devices called.");
            prtDbg("MarantzAvr: pair => get_devices: got IP address '" + data.avrip + "'.");
            prtDbg("MarantzAvr: pair => get_devices: got port '" + data.avrport + "'.");
            prtDbg("MarantzAvr: pair => get_devices: got AVR name '" + data.avrname + "'.");
            prtDbg("MarantzAvr: pair => get_devices: got AVR type '" + data.avrtype + "'.");
        }

        var curSlot = -1;

        for (var I = 0; I < MAX_AVRS; I++) {

            if (avrDevArray[I].used === false) {
                curSlot = I;
                prtDbg("Using slot " + I + ".");
                break;
            }
        }

        newDevInfo = {
            avrip: data.avrip,
            avrport: data.avrport,
            avrname: data.avrname,
            avrtype: data.avrtype,
            avrindex: curSlot
        };

        socket.emit("continue", null);
    }).on("disconnect", function () {

        prtDbg("Marantz app - User aborted pairing, or pairing is finished");
    });
};

/**
 * Capabilities of the AVR application.
 * onoff: AVR power on or off.
 */
var capabilities = {

    onoff: {
        get: function get(device_data, callback) {

            if (device_data instanceof Error || !device_data) {
                return callback(device_data);
            }

            if (avrDevArray[device_data.avrindex].used === true) {

                if (avrDevArray[device_data.avrindex].connected === true) {

                    var powerStatus = avrDevArray[device_data.avrindex].dev.getPowerOnOffState();

                    callback(null, powerStatus);
                } else {

                    prtMsg(getI18String("error.devnotavail"));
                    callback(true, false);
                }
            } else {
                prtMsg(getI18String("error.devnotused"));
                callback(true, false);
            }
        },
        set: function set(device_data, data, callback) {

            if (device_data instanceof Error || !device_data) {
                return callback(device_data);
            }

            if (avrDevArray[device_data.avrindex].used === true) {

                if (data === true) {
                    avrDevArray[device_data.avrindex].dev.powerOn();
                } else {
                    avrDevArray[device_data.avrindex].dev.powerOff();
                }

                callback(null, true);
            } else {
                prtMsg(getI18String("error.devnotused"));
                callback(true, false);
            }
        }
    }
};

/**
 * Change saved parameters of the Homey device.
 *
 * @param      {Json-object}    device_data    The device data
 * @param      {Json-object}    newSet         The new set
 * @param      {Json-object}    oldSet         The old set
 * @param      {Array}          changedKeyArr  The changed key arr
 * @param      {Function}       callback       The callback
 * @return     'callback'
 */
var settings = function settings(device_data, newSet, oldSet, changedKeyArr, callback) {

    if (myDebugMode === true) {
        prtDbg(device_data.avrip);
        prtDbg(device_data.avrport);
        prtDbg(device_data.avrtype);
        prtDbg(device_data.avrindex);

        prtDbg(newSet.avrip);
        prtDbg(newSet.avrport);
        prtDbg(newSet.avrtype);
        prtDbg(newSet.avrindex);

        prtDbg(oldSet.avrip);
        prtDbg(oldSet.avrport);
        prtDbg(oldSet.avrtype);
        prtDbg(oldSet.avrindex);

        prtDbg(changedKeyArr);

        prtDbg("Device_data -> ", JSON.stringify(device_data));
        prtDbg("newSet -> ", JSON.stringify(newSet));
        prtDbg("oldSet -> ", JSON.stringify(changedKeyArr));
    }

    var nIP = device_data.avrip;
    var nPort = device_data.avrport;
    var nType = device_data.avrtype;
    var newAvr = false;
    var errorDect = false;
    var errorIdStr = "";
    // let avrDebugChg = false;
    // let homDebugChg = false;

    var num = parseInt(newSet.avrport);

    changedKeyArr.forEach(function (key) {

        switch (key) {

            case "avrip":
                if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(newSet.avrip)) {

                    prtDbg("Correct IP adresss " + nIP + ".");
                    nIP = newSet.avrip;
                    newAvr = true;
                } else {

                    errorDect = true;
                    errorIdStr = "error.invalidIP";
                }

                break;
            case "avrport":
                if (isNaN(num) || num < 0 || num > 65535) {
                    errorDect = true;
                    errorIdStr = "error.invalidPort";
                } else {
                    nPort = newSet.avrport;
                    newAvr = true;
                }
                break;
            case "avrtype":
                nType = newSet.avrtype;
                newAvr = true;
                break;
            // case "aDebug":
            //     avrDebugChg = true;
            //     break;
            // case "hDebug":
            //     homDebugChg = true;
            //     break;
        }
    });

    if (errorDect === false) {

        if (newAvr === true) {

            if (avrDevArray[device_data.avrindex].used === true) {

                avrDevArray[device_data.avrindex].dev.disconnect();
                avrDevArray[device_data.avrindex].dev = null;
            }

            var xDev = {
                dev: new Avr(),
                available: false,
                confloaded: false,
                used: true
            };

            avrDevArray[device_data.avrindex] = xDev;

            prtDbg("Check -> " + nPort + ":" + nIP + ":" + nType + ".");

            avrDevArray[device_data.avrindex].dev.init(nPort, nIP, device_data.avrname, nType, device_data.avrindex, avrSvr);
        }

        // if ( avrDebugChg === true ) {
        //     if ( newSet.aDebug === true ) {

        //         avrDevArray[ device_data.avrindex].dev.setConsoleToDebug();

        //     } else {
        //         avrDevArray[ device_data.avrindex].dev.setConsoleOff();
        //     }
        // }

        // if ( homDebugChg === true ) {

        //     if ( newSet.hDebug === true ) {

        //         switchOnDebugMode();
        //     } else {

        //         switchOffDebugMode();
        //     }
        // }

        prtDbg("Settings returning oke");
        callback(null, true);
    } else {
        prtDbg("Settings returning a failure");
        callback(new Error(getI18String(errorIdStr)), false);
    }
};

/**************************************************
 * Homey is shutting down/ reboots, Close the open network connections.
 **************************************************/

/**
 * Homey.on("unload").
 * Called when Homey requests the app to stop/unload.
 */
Homey.on("unload", function () {

    for (var I = 0; I < avrDevArray.length; I++) {

        if (avrDevArray[I].used === true) {

            avrDevArray[I].dev.disconnect();

            var xDev = {
                dev: null,
                available: false,
                confloaded: false,
                used: false
            };

            avrDevArray[I] = xDev;
        }
    }
});

/**************************************************
 * power methodes, valid for all Marantz devices.
 **************************************************/

Homey.manager("flow").on("action.poweron", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.powerOn();

            callback(null, true);
        } else {

            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {

        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
}).on("action.poweroff", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.powerOff();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
});

/**************************************************
 * main_zone-power methodes, valid for all Marantz devices.
 **************************************************/

Homey.manager("flow").on("action.main_zone_poweron", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.mainZonePowerOn();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
}).on("action.main_zone_poweroff", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.mainZonePowerOff();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
});

/**************************************************
 * mute methodes, valid for all Marantz devices.
 **************************************************/
Homey.manager("flow").on("action.mute", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.muteOn();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
}).on("action.unmute", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.muteOff();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
});

/**************************************************
 * Input source selection based on the available sources per AVR.
 **************************************************/

Homey.manager("flow").on("action.selectinput.input.autocomplete", function (callback, args) {

    if (typeof args.device === "undefined") {
        // The AVR must be selected first as the input source selection
        // is depending on it.
        // If continue without the AVR runtime errors will occur.
        //
        prtMsg("Error: No device selected");

        callback(new Error(getI18String("error.devnotsel")), false);
    } else {

        if (avrDevArray[args.device.avrindex].used === true) {

            if (avrDevArray[args.device.avrindex].confLoaded === true) {

                var items = avrDevArray[args.device.avrindex].dev.getValidInputSelection();

                var cItems = [];

                for (var I = 0; I < items.length; I++) {
                    var x = {};
                    x.command = items[I].command;
                    x.name = getI18String(items[I].i18n);

                    cItems.push(x);
                }

                callback(null, cItems);
            } else {
                // Configuration (AVR type.json file) not loaded.
                // That is needed otherwise runtime error will occur.
                //
                prtMsg("Error: " + args.device.avrname + " has not loaded the configuration.");

                callback(new Error(getI18String("error.devnotconf")), false);
            }
        } else {
            // Try to access a slot in the dev Array which does not have
            // a AVR attached to it.
            //
            prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

            callback(new Error(getI18String("error.devnotused")), false);
        }
    }
}).on("action.selectinput", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.sendInputSourceCommand(args.input.command);

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: " + args.device.avrname + " has not loaded the configuration.");

        callback(new Error(getI18String("error.devnotconf")), false);
    }
});

/**************************************************
 * Volume methodes, valid for all Marantz devices.
 **************************************************/

Homey.manager("flow").on("action.volumeup", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.volumeUp();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
}).on("action.volumedown", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.volumeDown();

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
}).on("action.setvolume", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.setVolume(args.volumeNum);

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

        callback(new Error(getI18String("error.devnotused")), false);
    }
});

/**************************************************
 * Surround selection based on the available sources per AVR.
 **************************************************/

Homey.manager("flow").on("action.surround.input.autocomplete", function (callback, args) {

    if (typeof args.device === "undefined") {
        // The AVR must be selected first as the input source selection
        // is depending on it.
        // If continue without the AVR runtime errors will occur.
        //
        prtMsg("Error: No device selected");

        callback(new Error(getI18String("error.devnotsel")), false);
    } else {

        if (avrDevArray[args.device.avrindex].used === true) {

            if (avrDevArray[args.device.avrindex].confLoaded === true) {

                var items = avrDevArray[args.device.avrindex].dev.getValidSurround();

                var cItems = [];

                for (var I = 0; I < items.length; I++) {
                    var x = {};
                    x.command = items[I].command;
                    x.name = getI18String(items[I].i18n);

                    cItems.push(x);
                }

                callback(null, cItems);
            } else {
                // Configuration (AVR type.json file) not loaded.
                // That is needed otherwise runtime error will occur.
                //
                prtMsg("Error: " + args.device.avrname + " has not loaded the configuration.");

                callback(new Error(getI18String("error.devnotconf")), false);
            }
        } else {
            // Try to access a slot in the dev Array which does not have
            // a AVR attached to it.
            //
            prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

            callback(new Error(getI18String("error.devnotused")), false);
        }
    }
}).on("action.surround", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.sendSurroundCommand(args.input.command);

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: " + args.device.avrname + " has not loaded the configuration.");

        callback(new Error(getI18String("error.devnotconf")), false);
    }
});

/**************************************************
 * eco methodes, based on the support per AVR.
 *
 * NEED TO BE CHANGED:
 * Needs to be conditional: should be available only when AVR supports ECO
 * Currently it needs to defined in app.json regardsless if it is supported or not.
 *
 * Currently if ECO is not supported an array with 1 entry "not supported" is returned.
 **************************************************/
Homey.manager("flow").on("action.eco.input.autocomplete", function (callback, args) {

    if (typeof args.device === "undefined") {
        // The AVR must be selected first as the input source selection
        // is depending on it.
        // If continue without the AVR runtime errors will occur.
        //
        prtMsg("Error: No device selected");

        callback(new Error(getI18String("error.devnotsel")), false);
    } else {

        if (avrDevArray[args.device.avrindex].used === true) {

            if (avrDevArray[args.device.avrindex].confLoaded === true) {

                var items = avrDevArray[args.device.avrindex].dev.getValidEcoCommands();

                var cItems = [];

                for (var I = 0; I < items.length; I++) {
                    var x = {};
                    x.command = items[I].command;
                    x.name = getI18String(items[I].i18n);

                    cItems.push(x);
                }

                callback(null, cItems);
            } else {
                // Configuration (AVR type.json file) not loaded.
                // That is needed otherwise runtime error will occur.
                //
                prtMsg("Error: " + args.device.avrname + " has not loaded the configuration.");

                callback(new Error(getI18String("error.devnotconf")), false);
            }
        } else {
            // Try to access a slot in the dev Array which does not have
            // a AVR attached to it.
            //
            prtMsg("Error: Slot " + args.device.avrindex + " is not used.");

            callback(new Error(getI18String("error.devnotused")), false);
        }
    }
}).on("action.eco", function (callback, args) {

    if (avrDevArray[args.device.avrindex].used === true) {

        if (avrDevArray[args.device.avrindex].available == true) {

            avrDevArray[args.device.avrindex].dev.sendEcoCommand(args.input.command);

            callback(null, true);
        } else {
            // Configuration (AVR type.json file) not loaded.
            // That is needed otherwise runtime error will occur.
            //
            prtMsg("Error: " + args.device.avrname + " is not available.");

            callback(new Error(getI18String("error.devnotavail")), false);
        }
    } else {
        // Try to access a slot in the dev Array which does not have
        // a AVR attached to it.
        //
        prtMsg("Error: " + args.device.avrname + " has not loaded the configuration.");

        callback(new Error(getI18String("error.devnotconf")), false);
    }
});

module.exports.deleted = deleted;
module.exports.added = added;
module.exports.init = init;
module.exports.pair = pair;
module.exports.capabilities = capabilities;
module.exports.settings = settings;
