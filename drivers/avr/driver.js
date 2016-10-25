"use strict";
/* ================================================================== */
/* = Note:                                                          = */
/* = This is a generated javascript file.                           = */
/* = Don't edit the javascript file directly or changes might be    = */
/* = lost with the next build.                                      = */
/* = Edit the typescipt file instead and re-generate the javascript = */
/* = file.                                                          = */
/* ================================================================== */
var events = require("events");
var avr_1 = require("./lib/avr");
var MAX_AVRS = 8; // Max allowed AVR configurations
var RESTART_WAIT_TIME = 10000; // 10 sec.
var avrComChannel = null; // event channel
var myDebugMode = true; // Write debug messages or not
var avrDevArray = []; // AVR device array
var newDevInfo = null; // New device
var knownAvrs = []; // Known avr names.
var knownDevs = []; // Known used devices
/**
 * Prints debug messages using homey.log if debug is switched on.
 *
 * @param      {string}  str     The message string
 */
var prtDbg = function (str) {
    if (myDebugMode === true) {
        Homey.log("[D] " + str);
    }
};
/**
 * Prints error message via Homey.log
 *
 * @param      {string}  str     The message string
 */
var prtErr = function (str) {
    Homey.log("[HomeyAvr_Error]: " + str + ".");
};
/**
 * Notify Homey the AVR is unavailabble, i.e no network connection.
 * @param      {AvrDeviceData}     device_data   Device information.
 * @param      {string}            str           Reason why unavailabble.
 */
var setAvrUnavailable = function (device_data, str) {
    module.exports.setUnavailable(device_data, str);
};
/**
 * Notify Homey the AVR is available, i.e the AVR is connected.
 * @param      {AvrDeviceData}     device_data   Device information.
 */
var setAvrAvailable = function (device_data) {
    module.exports.setAvailable(device_data);
};
/**
 * Gets the string defined in the locales files of homey.
 *
 * @param      {string}  str     The ID string
 * @return     {string}  The 'locales' string for the ID.
 */
var getI18nString = function (str) {
    return Homey.manager("i18n").__(str);
};
/**
 * Initialize the HOMEY AVR application paramaters called after
 * startup or reboot of Homey.
 *
 * @param      {Array.<AvrDeviceData>}     devices   Array with all devices info.
 * @param      {Function}  callback  Notify Homey we have started
 * @return     'callback'
 */
var init = function (devices, callback) {
    if (myDebugMode === true) {
        prtDbg("Init called.");
        prtDbg("Devices => " + JSON.stringify(devices));
    }
    if (avrComChannel === null) {
        /* ============================================================== */
        /* = Initialize the avrDevArray and knownDevs.                  = */
        /* ============================================================== */
        for (var I = 0; I < MAX_AVRS; I++) {
            avrDevArray[I] = {
                dev: null,
                available: false,
                confLoaded: false,
                used: false
            };
            knownDevs[I] = {
                avrip: "",
                avrport: 23,
                avrname: "",
                avrtype: "",
                avrindex: -1
            };
        }
        avrComChannel = new events.EventEmitter();
        setUpListeners();
        if (devices.length !== 0) {
            devices.forEach(function (device) {
                if (device.avrindex >= 0 && device.avrindex < MAX_AVRS) {
                    avrDevArray[device.avrindex] = {
                        dev: new avr_1.AVR(),
                        available: false,
                        confLoaded: false,
                        used: true
                    };
                    avrDevArray[device.avrindex].dev.init(device.avrport, device.avrip, device.avrname, device.avrtype, device.avrindex, avrComChannel);
                    knownAvrs.push({
                        name: device.avrname,
                        avr: device.avrname
                    });
                    knownDevs[device.avrindex] = device;
                    setAvrUnavailable(device, getI18nString("devnotavil"));
                }
                else {
                    prtErr("Invalid avrindex : " + device.avrindex + ".");
                }
            });
            if (myDebugMode === true) {
                for (var I = 0; I < avrDevArray.length; I++) {
                    if (avrDevArray[I].used === true) {
                        var xStr = (avrDevArray[I].dev.getName() + "/" + avrDevArray[I].dev.getType() + "-") +
                            (avrDevArray[I].dev.getHostname() + ":" + avrDevArray[I].dev.getPort());
                        prtDbg("Entry " + I + " has " + xStr + ".");
                    }
                    else {
                        prtDbg("Entry " + I + " is not used.");
                    }
                }
                prtDbg("KnownAvrs :");
                for (var I = 0; I < knownAvrs.length; I++) {
                    prtDbg(I + " -> " + knownAvrs[I].name + ".");
                }
                prtDbg("KnownDevs :");
                for (var I = 0; I < MAX_AVRS; I++) {
                    prtDbg(I + " -> " + JSON.stringify(knownDevs[I]) + ".");
                }
            }
        }
        setUpFlowActionsAndTriggers();
    }
    else {
        prtDbg("Init called for the second time ??.");
    }
    callback(null, "");
};
/**
 * Homey delete request for an AVR.
 *
 * @param      AvrDeviceData  device    Info of the to-be-delete device
 * @param      Function  callback  Inform Homey of the result.
 * @return     'callback'
 */
var deleted = function (device, callback) {
    if (myDebugMode === true) {
        prtDbg("HomeyAvr: delete_device called");
        prtDbg("Device => " + JSON.stringify(device));
    }
    if (avrDevArray[device.avrindex].used === false) {
        callback(new Error(getI18nString("error.dev_mis_del")), false);
    }
    else {
        /* ============================================================== */
        /* = Disconnect and remove possible existing network connection = */
        /* = to the AVR                                                 = */
        /* ============================================================== */
        avrDevArray[device.avrindex].dev.disconnect();
        /* ============================================================== */
        /* = Remove the AVR from the known avrs list                    = */
        /* ============================================================== */
        for (var I = 0; I < knownAvrs.length; I++) {
            if (knownAvrs[I].name === device.avrname) {
                knownAvrs.splice(I, 1);
            }
        }
        /* ============================================================== */
        /* = Remove the AVR from the known devs list                    = */
        /* ============================================================== */
        knownDevs[device.avrindex] = {
            avrip: "",
            avrport: 23,
            avrname: "",
            avrtype: "",
            avrindex: -1
        };
        /* ============================================================== */
        /* = Clear the entry in the device array                        = */
        /* ============================================================== */
        avrDevArray[device.avrindex] = {
            dev: null,
            available: false,
            confLoaded: false,
            used: false
        };
        if (myDebugMode === true) {
            for (var I = 0; I < avrDevArray.length; I++) {
                if (avrDevArray[I].used === true) {
                    var xStr = (avrDevArray[I].dev.getName() + "-") +
                        (avrDevArray[I].dev.getHostname() + ":" + avrDevArray[I].dev.getPort() + ".");
                    prtDbg("Entry " + I + " has " + xStr + ".");
                }
                else {
                    prtDbg("Entry " + I + " is not used.");
                }
            }
            prtDbg("KnownAvrs :");
            for (var I = 0; I < knownAvrs.length; I++) {
                prtDbg(I + " -> " + knownAvrs[I].name + ".");
            }
            prtDbg("KnownDevs :");
            for (var I = 0; I < MAX_AVRS; I++) {
                prtDbg(I + " -> " + JSON.stringify(knownDevs[I]) + ".");
            }
        }
        callback(null, true);
    }
};
/**
* Homey add request for an AVR.
*
* @param      AvrDeviceData  device    Info of the to-be-delete device
* @param      Function  callback  Inform Homey of the result.
* @return     'callback'
 */
var added = function (device, callback) {
    if (myDebugMode === true) {
        prtDbg("HomeyAvr: add_device called");
        prtDbg("device => " + JSON.stringify(device));
    }
    avrDevArray[device.avrindex] = {
        dev: new avr_1.AVR(),
        available: false,
        confLoaded: false,
        used: true
    };
    avrDevArray[device.avrindex].dev.init(device.avrport, device.avrip, device.avrname, device.avrtype, device.avrindex, avrComChannel);
    knownAvrs.push({ name: device.avrname, avr: device.avrname });
    knownDevs[device.avrindex] = device;
    if (myDebugMode === true) {
        prtDbg("New device array :");
        for (var I = 0; I < avrDevArray.length; I++) {
            if (avrDevArray[I].used == true) {
                var host = avrDevArray[I].dev.getHostname();
                var port = avrDevArray[I].dev.getPort();
                var used = avrDevArray[I].used;
                prtDbg("Entry " + I + " has " + host + ":" + port + " (" + used + ").");
            }
            else {
                prtDbg("Entry " + I + " is not used.");
            }
        }
        prtDbg("KnownAvrs :");
        for (var I = 0; I < knownAvrs.length; I++) {
            prtDbg(I + " -> " + knownAvrs[I].name + ".");
        }
        prtDbg("KnownDevs :");
        for (var I = 0; I < MAX_AVRS; I++) {
            prtDbg(I + " -> " + JSON.stringify(knownDevs[I]) + ".");
        }
    }
    callback(null, true);
};
/**
 * Pair Homey with new devices.
 *
 * @method     pair
 * @param      net.Socket  socket  communication socket
 * @return     'callback'
 */
var pair = function (socket) {
    socket
        .on("list_devices", function (data, callback) {
        // Data doesnt contain information ({}).
        if (myDebugMode === true) {
            prtDbg("HomeyAvr: pair => list_devices called.");
            prtDbg("data => " + JSON.stringify(data));
            prtDbg("newDevInfo => " + JSON.stringify(newDevInfo));
        }
        if (newDevInfo.avrindex === -1) {
            callback(new Error(getI18nString("error.full_dev_ar")), {});
        }
        var devices = [
            {
                name: newDevInfo.avrname,
                data: {
                    id: newDevInfo.avrname,
                    avrip: newDevInfo.avrip,
                    avrport: newDevInfo.avrport,
                    avrname: newDevInfo.avrname,
                    avrtype: newDevInfo.avrtype,
                    avrindex: newDevInfo.avrindex
                }
            }
        ];
        newDevInfo = null;
        callback(null, devices);
    })
        .on("get_devices", function (data) {
        if (myDebugMode === true) {
            prtDbg("HomeyAvr: pair => get_devices called.");
            prtDbg("data => " + JSON.stringify(data));
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
            avrport: parseInt(data.avrport),
            avrname: data.avrname,
            avrtype: data.avrtype,
            avrindex: curSlot
        };
        socket.emit("continue", null);
    })
        .on("disconnect", function () {
        prtDbg("HomeyAvr - User aborted pairing, or pairing is finished");
    });
};
/**
 * Capabilities of the AVR application.
 * onoff: AVR power on or off.
 */
var capabilities = {
    onoff: {
        get: function (device_data, callback) {
            if (myDebugMode === true) {
                prtDbg("Capabilities - get");
                prtDbg("device_data => " + JSON.stringify(device_data));
            }
            if (avrDevArray[device_data.avrindex].used === true) {
                if (avrDevArray[device_data.avrindex].available === true) {
                    callback(null, avrDevArray[device_data.avrindex].dev.getPowerOnOffState());
                }
                else {
                    callback(new Error(getI18nString("error.devnotavail")), false);
                }
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        },
        set: function (device_data, data, callback) {
            if (myDebugMode === true) {
                prtDbg("Capabilities - set ");
                prtDbg("Device_data => " + JSON.stringify(device_data));
                prtDbg("Data => " + JSON.stringify(data));
            }
            if (avrDevArray[device_data.avrindex].used === true) {
                if (avrDevArray[device_data.avrindex].available === true) {
                    if (data === true) {
                        avrDevArray[device_data.avrindex].dev.powerOn();
                    }
                    else {
                        avrDevArray[device_data.avrindex].dev.powerOff();
                    }
                    callback(null, true);
                }
                else {
                    callback(new Error(getI18nString("error.devnotavail")), false);
                }
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    }
};
/**
 * Change saved parameters of the Homey device.
 *
 * @param      AvrDeviceData    device_data    The device data
 * @param      SetttingsData    newSet         The new set
 * @param      SetttingsData    oldSet         The old set
 * @param      Array<string>,   changedKeyArr  The changed key arr
 * @param      Function         callback       The callback
 * @return     'callback'
 */
var settings = function (device_data, newSet, oldSet, changedKeyArr, callback) {
    if (myDebugMode === true) {
        prtDbg("Capabilities get : ");
        prtDbg("device_data => " + JSON.stringify(device_data));
        prtDbg("newSet => " + JSON.stringify(newSet));
        prtDbg("oldSet => " + JSON.stringify(oldSet));
        prtDbg("changedKeyArr =>" + JSON.stringify(changedKeyArr));
    }
    var nIP = device_data.avrip;
    var nPort = device_data.avrport;
    var nType = device_data.avrtype;
    var isChanged = 0;
    var errorDect = 0;
    var errorIdStr = "";
    var num = parseInt(newSet.avrport);
    changedKeyArr.forEach(function (key) {
        switch (key) {
            case "avrip":
                if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(newSet.avrip)) {
                    prtDbg("Correct IP adresss " + nIP + ".");
                    nIP = newSet.avrip;
                    isChanged = 1;
                }
                else {
                    errorDect = 1;
                    errorIdStr = "error.invalidIP";
                }
                break;
            case "avrport":
                if (isNaN(num) || num < 0 || num > 65535) {
                    errorDect = 1;
                    errorIdStr = "error.invalidPort";
                }
                else {
                    nPort = parseInt(newSet.avrport);
                    isChanged = 1;
                }
                break;
            case "avrtype":
                nType = newSet.avrtype;
                isChanged = 1;
                break;
        }
    });
    if (errorDect === 1) {
        prtDbg("Settings returning a failure");
        callback(new Error(getI18nString(errorIdStr)), false);
        return;
    }
    if (isChanged === 1) {
        if (avrDevArray[device_data.avrindex].used === true) {
            avrDevArray[device_data.avrindex].dev.disconnect();
            avrDevArray[device_data.avrindex].dev = null;
        }
        avrDevArray[device_data.avrindex] = {
            dev: new avr_1.AVR(),
            available: false,
            confLoaded: false,
            used: true
        };
        prtDbg("Check -> " + nIP + ":" + nPort + ":" + nType + ".");
        avrDevArray[device_data.avrindex].dev.init(nPort, nIP, device_data.avrname, nType, device_data.avrindex, avrComChannel);
    }
    knownDevs[device_data.avrindex] = {
        avrip: nIP,
        avrport: nPort,
        avrname: device_data.avrname,
        avrtype: nType,
        avrindex: device_data.avrindex
    };
    callback(null, true);
};
/**
 * Homey.on("unload").
 * Called when Homey requests the app to stop/unload.
 */
Homey.on("unload", function () {
    /* ================================================================ */
    /* = Homey requests to 'unload/stop'.                             = */
    /* = For all known devices: disconnnect                           = */
    /* ================================================================ */
    for (var I = 0; I < avrDevArray.length; I++) {
        if (avrDevArray[I].used === true) {
            avrDevArray[I].dev.disconnect();
        }
    }
});
/**
 * Homey.on("cpuwarn")
 * Called when Homey informs us the program takes too much cpu power.
 * Currently the reaction is to close down,
 */
Homey.on("cpuwarn", function () {
    /* ================================================================ */
    /* = Homey warning HomeyAVr takes more the 80 of the cpu.         = */
    /* = For all known devices: disconnnect                           = */
    /* ================================================================ */
    for (var I = 0; I < avrDevArray.length; I++) {
        for (var I_1 = 0; I_1 < avrDevArray.length; I_1++) {
            if (avrDevArray[I_1].used === true) {
                avrDevArray[I_1].dev.disconnect();
            }
        }
    }
});
/**
 * Set up event listeners on events fro the AVR controller..
 */
var setUpListeners = function () {
    avrComChannel
        .on("init_success", function (num, name, type) {
        prtDbg("AVR " + name + " (slot:" + num + ") has loaded the " + type + ".json file.");
        avrDevArray[num].confLoaded = true;
    })
        .on("init_failed", function (num, name, type) {
        prtDbg("Error: AVR " + name + " (slot:" + num + ") has fail to load the " + type + ".json file.");
        avrDevArray[num].confLoaded = false;
    })
        .on("net_connected", function (num, name) {
        prtDbg("AVR " + name + " (slot:" + num + ") is connected.");
        avrDevArray[num].available = true;
        setAvrAvailable(knownDevs[num]);
    })
        .on("net_disconnected", function (num, name) {
        prtDbg("AVR " + name + " (slot:" + num + ") is disconnected.");
        avrDevArray[num].available = false;
        setAvrUnavailable(knownDevs[num], getI18nString("error.devnotcon"));
    })
        .on("net_timedout", function (num, name) {
        prtDbg("AVR " + name + " (slot:" + num + ") timed out.");
        avrDevArray[num].available = false;
        setAvrUnavailable(knownDevs[num], getI18nString("error.devnotcon"));
    })
        .on("net_error", function (num, name, err) {
        prtDbg("AVR " + name + " (slot:" + num + ") has a network error -> " + err + ".");
        avrDevArray[num].available = false;
        setAvrUnavailable(knownDevs[num], getI18nString("error.devnotcon"));
    })
        .on("net_uncaught", function (num, name, err) {
        prtDbg("AVR " + name + " (slot:" + num + ") : uncaught event '" + err + "'.");
        avrDevArray[num].available = false;
        setAvrUnavailable(knownDevs[num], getI18nString("error.devnotcon"));
    })
        .on("power_status_chg", function (num, name, newcmd, oldcmd) {
        prtDbg("Power: AVR " + name + " (slot:" + num + ") : " + newcmd + " - " + oldcmd);
        if (newcmd === "power.on" && oldcmd === "power.off") {
            Homey.manager("flow").trigger("t_power_on", { name: name }, { name: name });
        }
        else if (newcmd === "power.off" && oldcmd === "power.on") {
            Homey.manager("flow").trigger("t_power_off", { name: name }, { name: name });
        }
    })
        .on("mzpower_status_chg", function (num, name, newcmd, oldcmd) {
        prtDbg("Mzpower: AVR " + name + " (slot:" + num + ") : " + newcmd + " - " + oldcmd);
        if (newcmd === "mzpower.on" && oldcmd === "mzpower.off") {
            Homey.manager("flow").trigger("t_mzpower_on", { name: name }, { name: name });
        }
        else if (newcmd === "mzpower.off" && oldcmd === "mzpower.on") {
            Homey.manager("flow").trigger("t_mzpower_off", { name: name }, { name: name });
        }
    })
        .on("mute_status_chg", function (num, name, newcmd, oldcmd) {
        prtDbg("Mute: AVR " + name + " (slot:" + num + ") : " + newcmd + " - " + oldcmd);
        if (newcmd === "mute.on" && oldcmd === "mute.off") {
            Homey.manager("flow").trigger("t_mute_on", { name: name }, { name: name });
        }
        else if (newcmd === "mute.off" && oldcmd === "mute.on") {
            Homey.manager("flow").trigger("t_mute_off", { name: name }, { name: name });
        }
    })
        .on("eco_status_chg", function (num, name, newStat, oldStat) {
        prtDbg("Eco: AVR " + name + " (slot:" + num + "): " + newStat + " - " + oldStat);
        Homey.manager("flow").trigger("t_eco_on", { name: name }, { name: name, command: newStat });
        Homey.manager("flow").trigger("t_eco_off", { name: name }, { name: name, command: oldStat });
    })
        .on("isource_status_chg", function (num, name, newStat, oldStat) {
        prtDbg("Inputsource: AVR " + name + " (slot:" + num + "): newStat:" + newStat + " - oldStat:" + oldStat);
        Homey.manager("flow").trigger("t_inputsource_sel", { name: name }, { name: name, command: newStat });
        Homey.manager("flow").trigger("t_inputsource_des", { name: name }, { name: name, command: oldStat });
    })
        .on("surround_status_chg", function (num, name, newStat, oldStat) {
        prtDbg("Surround: AVR " + name + " (slot:" + num + "): newStat:" + newStat + " - oldStat:" + oldStat);
        Homey.manager("flow").trigger("t_surround_sel", { name: name }, { name: name, command: newStat });
        Homey.manager("flow").trigger("t_surround_des", { name: name }, { name: name, command: oldStat });
    })
        .on("volume_chg", function (num, name, value) {
        prtDbg("Avr " + name + " (slot " + num + ") changed volume to " + value + ".");
    })
        .on("debug_log", function (num, name, msg) {
        prtDbg("AVR " + name + " (slot " + num + ") " + msg + ".");
    })
        .on("uncaughtException", function (err) {
        prtDbg("Oops: uncaught exception: " + err + " !.");
    });
};
var setUpFlowActionsAndTriggers = function () {
    Homey.manager("flow")
        .on("action.poweron", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("action.poweron :");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.powerOn();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("action.poweroff", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("action.poweroff :");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.powerOff();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("trigger.t_power_on.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_power_off.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_power_on", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("trigger.t_power_on :");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        prtDbg("On Trigger t_power_on called");
        callback(null, true);
    })
        .on("trigger.t_power_off", function (callback, args, data) {
        prtDbg("On Trigger t_power_off called");
        callback(null, true);
    })
        .on("action.main_zone_poweron", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action.main_zone_poweron : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.mainZonePowerOn();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("action.main_zone_poweroff", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action.main_zone_poweroff : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.mainZonePowerOff();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("trigger.t_mzpower_on.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_mzpower_off.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_mzpower_on", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_mzpower_on : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        callback(null, true);
    })
        .on("trigger.t_mzpower_off", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_mzpower_off : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        callback(null, true);
    })
        .on("action.mute", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action.mute : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.muteOn();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("action.unmute", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action.unmute : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.muteOff();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("trigger.t_mute_on.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_mute_off.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_mute_on", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_mute_on : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        callback(null, true);
    })
        .on("trigger.t_mute_off", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_mute_off : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        callback(null, true);
    })
        .on("action.eco.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action.eco input complete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var cItems = [];
                if (avrDevArray[index].dev.hasEco() === true) {
                    var items = avrDevArray[index].dev.getValidEcoModes();
                    for (var I = 0; I < items.length; I++) {
                        cItems.push({
                            command: items[I].command,
                            name: getI18nString(items[I].i18n)
                        });
                    }
                }
                else {
                    cItems.push({
                        command: "",
                        name: getI18nString("eco.ns")
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("action.eco", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action.eco : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                if (avrDevArray[args.device.avrindex].dev.hasEco() === true) {
                    avrDevArray[args.device.avrindex].dev.sendEcoCommand(args.input.command);
                    callback(null, true);
                }
                else {
                    callback(new Error(getI18nString("error.econotsup")), false);
                }
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotconf")), false);
        }
    })
        .on("trigger.t_eco_on.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_eco_on : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                if (avrDevArray[index].dev.hasEco() === true) {
                    var items = avrDevArray[index].dev.getValidEcoModes();
                    var cItems = [];
                    for (var I = 0; I < items.length; I++) {
                        cItems.push({
                            command: items[I].command,
                            name: getI18nString(items[I].i18n),
                            i18n: items[I].i18n
                        });
                    }
                    callback(null, cItems);
                }
                else {
                    callback(new Error(getI18nString("error.econotsup")), false);
                }
            }
            else {
                prtDbg("Error: AVR " + args.args.device.name + " not found.");
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_eco_off.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_eco_off imput complete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                if (avrDevArray[index].dev.hasEco() === true) {
                    var items = avrDevArray[index].dev.getValidEcoModes();
                    var cItems = [];
                    for (var I = 0; I < items.length; I++) {
                        cItems.push({
                            command: items[I].command,
                            name: getI18nString(items[I].i18n),
                            i18n: items[I].i18n
                        });
                    }
                    callback(null, cItems);
                }
                else {
                    callback(new Error(getI18nString("error.econotsup")), false);
                }
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_eco_on.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_eco_off.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_eco_on", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_eco_on : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        if (data.name === args.device.avrname && data.command === args.input.i18n) {
            callback(null, true);
        }
        {
            callback(null, false);
        }
    })
        .on("trigger.t_eco_off", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_eco_off : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        if (data.name === args.device.avrname && data.command === args.input.i18n) {
            callback(null, true);
        }
        {
            callback(null, false);
        }
    })
        .on("action.selectinput.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action selectinput imput complete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var items = avrDevArray[index].dev.getValidInputSelection();
                var cItems = [];
                for (var I = 0; I < items.length; I++) {
                    cItems.push({
                        command: items[I].command,
                        name: getI18nString(items[I].i18n)
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("action.selectinput", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action selectinput : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.selectInputSource(args.input.command);
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotconf")), false);
        }
    })
        .on("trigger.t_inputsource_sel.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Trigger t_inputsource_sel imput complete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var items = avrDevArray[index].dev.getValidInputSelection();
                var cItems = [];
                for (var I = 0; I < items.length; I++) {
                    cItems.push({
                        command: items[I].command,
                        name: getI18nString(items[I].i18n),
                        i18n: items[I].i18n
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_inputsource_des.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Trigger t_inputsource_des imput complete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var items = avrDevArray[index].dev.getValidInputSelection();
                var cItems = [];
                for (var I = 0; I < items.length; I++) {
                    cItems.push({
                        command: items[I].command,
                        name: getI18nString(items[I].i18n),
                        i18n: items[I].i18n
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_inputsource_sel.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_inputsource_des.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_inputsource_sel", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_inputsource_sel : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        if (data.name === args.device.avrname && data.command === args.input.i18n) {
            callback(null, true);
        }
        {
            callback(null, false);
        }
    })
        .on("trigger.t_inputsource_des", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_inputsource_des : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        prtDbg(JSON.stringify(args));
        prtDbg(JSON.stringify(data));
        if (data.name === args.device.avrname && data.command === args.input.i18n) {
            callback(null, true);
        }
        {
            callback(null, false);
        }
    })
        .on("action.surround", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action surround : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.setSurrroundCommand(args.input.command);
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotconf")), false);
        }
    })
        .on("action.surround.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action surround input autocomplete: ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var items = avrDevArray[index].dev.getValidSurround();
                var cItems = [];
                for (var I = 0; I < items.length; I++) {
                    cItems.push({
                        command: items[I].command,
                        name: getI18nString(items[I].i18n)
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_surround_sel.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Trigger t_surround_sel input autocomplete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var items = avrDevArray[index].dev.getValidSurround();
                var cItems = [];
                for (var I = 0; I < items.length; I++) {
                    cItems.push({
                        command: items[I].command,
                        name: getI18nString(items[I].i18n),
                        i18n: items[I].i18n
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_surround_des.input.autocomplete", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Trigger t_surround_des input autocomplete : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (typeof (args.args.device.name) === "undefined") {
            callback(new Error(getI18nString("error.devnotsel")), false);
        }
        else {
            var index = -1;
            for (var I = 0; I < MAX_AVRS; I++) {
                if (avrDevArray[I].used === true) {
                    if (avrDevArray[I].dev.getName() === args.args.device.name) {
                        index = I;
                        break;
                    }
                }
            }
            if (index !== -1) {
                var items = avrDevArray[index].dev.getValidSurround();
                var cItems = [];
                for (var I = 0; I < items.length; I++) {
                    cItems.push({
                        command: items[I].command,
                        name: getI18nString(items[I].i18n),
                        i18n: items[I].i18n
                    });
                }
                callback(null, cItems);
            }
            else {
                callback(new Error(getI18nString("error.devnotused")), false);
            }
        }
    })
        .on("trigger.t_surround_sel.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_surround_des.avrname.autocomplete", function (callback) {
        callback(null, knownAvrs);
    })
        .on("trigger.t_surround_sel", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_surround_sel : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        if (data.name === args.device.avrname && data.command === args.input.i18n) {
            callback(null, true);
        }
        {
            callback(null, false);
        }
    })
        .on("trigger.t_surround_des", function (callback, args, data) {
        if (myDebugMode === true) {
            prtDbg("Trigger.t_surround_des : ");
            prtDbg("args => " + JSON.stringify(args));
            prtDbg("data => " + JSON.stringify(data));
        }
        if (data.name === args.device.avrname && data.command === args.input.i18n) {
            callback(null, true);
        }
        {
            callback(null, false);
        }
    })
        .on("action.volumeup", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action volumeup : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.volumeUp();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("action.volumedown", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action volumedown : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.volumeDown();
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    })
        .on("action.setvolume", function (callback, args) {
        if (myDebugMode === true) {
            prtDbg("Action setvolume : ");
            prtDbg("args => " + JSON.stringify(args));
        }
        if (avrDevArray[args.device.avrindex].used === true) {
            if (avrDevArray[args.device.avrindex].available == true) {
                avrDevArray[args.device.avrindex].dev.setVolume(args.volumeNum);
                callback(null, true);
            }
            else {
                callback(new Error(getI18nString("error.devnotavail")), false);
            }
        }
        else {
            callback(new Error(getI18nString("error.devnotused")), false);
        }
    });
};
module.exports.deleted = deleted;
module.exports.added = added;
module.exports.init = init;
module.exports.pair = pair;
module.exports.capabilities = capabilities;
module.exports.settings = settings;
//# sourceMappingURL=driver.js.map