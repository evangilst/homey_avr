"use strict";
/* ================================================================== */
/* = Note:                                                          = */
/* = This is a generated javascript file.                           = */
/* = Don't edit the javascript file directly or change might be     = */
/* = lost with the next build.                                      = */
/* = Edit the typescipt file instead and re-generate the javascript = */
/* = file.                                                          = */
/* ================================================================== */
var path = require("path");
var fs = require("fs");
var net = require("net");
var events = require("events");
/* ==================================================================== */
/* TIME_TO_RETRY: (= 10 sec)                                            */
/* Time to wait before a re-open a new connection to the AVR will       */
/* take place after a connection has failed.                            */
/* ==================================================================== */
var TIME_TO_RETRY = 10000;
/* ==================================================================== */
/* WAIT_BETWEEN_TRANSMITS: (= 100 msec)                                 */
/* Time to wait between two consecutive command transmission.           */
/* Marantz; 70 msec or higher                                           */
/* ==================================================================== */
var WAIT_BETWEEN_TRANSMITS = 100;
/* ==================================================================== */
/* MAX_INDEX                                                            */
/*    Maximum send buffer size                                          */
/* ==================================================================== */
var MAX_INDEX = 64;
/* ==================================================================== */
/* MAX_VOLUME                                                           */
/*    Maximum volume level which can be set at once                     */
/* ==================================================================== */
var MAX_VOLUME = 80;
var AVR = (function () {
    function AVR() {
        this.avr_port = 0;
        this.avr_host = "";
        this.avr_name = "";
        this.avr_type = "";
        this.conf = {};
        this.insertIndex = 0;
        this.deleteIndex = 0;
        this.avr_avrnum = 0;
        this.hasConfigLoaded = false;
        this.hasToStop = false;
        this.hasNetworkConnection = false;
        this.isBufferLoopRunning = false;
        this.consoleOut = false;
        this.filter = true;
        this.selAr = [];
        this.surroundAr = [];
        this.ecoAr = [];
        this.sendBuffer = [];
        this.powerStatus = "Unknown";
        this.mainZonePowerStatus = "Unknown";
        this.muteStatus = "Unknown";
        this.inputSourceSelection = "Unknown";
        this.volumeStatus = "Unknown";
        this.surroundMode = "Unknown";
        this.ecoStatus = "Unknown";
        this.eventch = null;
        this.comChannel = null;
        /* ================================================================= */
        /* Initialize the send buffer                                        */
        /* ================================================================= */
        for (var I = 0; I < MAX_INDEX; I++) {
            this.sendBuffer[I] = "";
        }
        /* ================================================================= */
        /* Internal event handler                                            */
        /* ================================================================= */
        this.eventch = new events.EventEmitter();
        /* ================================================================= */
        /* Initaite the event listeners                                      */
        /* ================================================================= */
        this._eventLoop();
    }
    /**
     * Initialize a AVR.
     * @param {number}              sPort    The network port to use.
     * @param {string}              sHost    The hostname or IP address to be used.
     * @param {string}              sName    The given 'Homey name' of the AVR.
     * @param {string}              sType    The selectied Homey type of the AVR/
     * @param {number}              sNum     An index into the AVR array (internal)
     * @param {events.EventEmitter} sChannel Communication channel with the Homey part
     */
    AVR.prototype.init = function (sPort, sHost, sName, sType, sNum, sChannel) {
        var _this = this;
        this.avr_port = sPort;
        this.avr_host = sHost;
        this.avr_name = sName;
        this.avr_type = sType;
        this.avr_avrnum = sNum;
        this.comChannel = sChannel;
        var avRConfigFile = path.join(__dirname, "/conf/" + this.avr_type + ".json");
        fs.readFile(avRConfigFile, "utf8", function (err, data) {
            if (err) {
                _this.conf = null;
                _this.hasConfigLoaded = false;
                _this.comChannel.emit("init_failed", _this.avr_avrnum, _this.avr_type, err);
            }
            ;
            try {
                _this.conf = JSON.parse(data);
            }
            catch (err) {
                _this.conf = null;
                _this.hasConfigLoaded = false;
                _this.comChannel.emit("init_failed", _this.avr_avrnum, _this.avr_type, err);
            }
            _this.hasConfigLoaded = true;
            // Fill the input selection array with the entries supported by the AVR type
            _this._fillSelectionInfo();
            // Fill the surround selection array with the entries supported by the AVR type.
            _this._fillSurroundArray();
            // File the eco selection array with entries supported by the AVR.
            _this._fillEcoArray();
            _this.comChannel.emit("init_success", _this.avr_avrnum, _this.avr_name, _this.avr_type);
            _this.eventch.emit("config_loaded");
        });
    };
    /**
     * Creates an array with the supported input source selection for the selected AVR type.
     * @private
     */
    AVR.prototype._fillSelectionInfo = function () {
        for (var I = 0; I < this.conf.inputsource.length; I++) {
            if (typeof (this.conf.inputsource[I] !== "undefined" &&
                this.conf.inputsource[I] !== null)) {
                if (this.conf.inputsource[I].valid === true &&
                    this.conf.inputsource[I].prog_id !== "i_request") {
                    var item = {
                        i18n: this.conf.inputsource[I].i18n,
                        command: this.conf.inputsource[I].command
                    };
                    this.selAr.push(item);
                }
            }
        }
    };
    /**
     * Creates an array with the surround selection of the selected AVT type.
     * @private
     */
    AVR.prototype._fillSurroundArray = function () {
        for (var I = 0; I < this.conf.surround.length; I++) {
            if (typeof (this.conf.surround[I] !== "undefined" &&
                this.conf.surround[I] !== null)) {
                if (this.conf.surround[I].valid === true &&
                    this.conf.surround[I].prog_id !== "s_request") {
                    var item = {
                        i18n: this.conf.surround[I].i18n,
                        command: this.conf.surround[I].command
                    };
                    this.surroundAr.push(item);
                }
            }
        }
    };
    /**
     * Creates an array with the eco command selection for the selected AVR type.
     * @private
     */
    AVR.prototype._fillEcoArray = function () {
        if (this.hasEco() === true) {
            for (var I = 0; I < this.conf.eco.length; I++) {
                if (typeof (this.conf.eco[I] !== "undefined" &&
                    this.conf.eco[I] !== null)) {
                    if (this.conf.eco[I].valid === true &&
                        this.conf.eco[I].prog_id !== "eco_request") {
                        var item = {
                            i18n: this.conf.eco[I].i18n,
                            command: this.conf.eco[I].command
                        };
                        this.ecoAr.push(item);
                    }
                }
            }
        }
        else {
            this.ecoAr.push({ i18n: "error.econotsup", command: "eco_not_supported" });
        }
    };
    /**
     * EventLoop handles the avr driver control events.
     * @private
     */
    AVR.prototype._eventLoop = function () {
        var _this = this;
        this.eventch
            .on("config_loaded", function () {
            _this._d("Configuration loaded. Open a network connection...");
            _this._openConnection();
        })
            .on("net_connected", function () {
            _this._d("Connected with AVR.");
            _this._getAVRstatusUpdate(); // get the status of the AVR
            /* ============================================================ */
            /* Wait 2 sec before informing homey to the status of the AVR   */
            /* can be collected without interference.                       */
            /* Set hasNetworkConnection after the wait time and             */
            /* 'free' the device from Homey.                                */
            /* ============================================================ */
            setTimeout(function () {
                _this._d("Informing Homey AVR is available.");
                _this.hasNetworkConnection = true;
                _this.comChannel.emit("net_connected", _this.avr_avrnum, _this.avr_name);
            }, 2000);
        })
            .on("net_disconnected", function () {
            /* ============================================================ */
            /* - Notify Homey the network connection is lost.               */
            /* - Try to reconnect again.                                    */
            /* ============================================================ */
            _this._d("Network disconnected....");
            _this.comChannel.emit("net_disconnected", _this.avr_avrnum, _this.avr_name);
            _this.eventch.emit("net_retry");
        })
            .on("net_error", function (err) {
            /* ============================================================ */
            /* - Notify Homey the network connection is disconneted.        */
            /* - Try to reconnect again.                                    */
            /* ============================================================ */
            _this._d("Network error " + err);
            _this.comChannel.emit("net_error", _this.avr_avrnum, _this.avr_name, err);
            _this.eventch.emit("net_retry");
        })
            .on("net_timedout", function () {
            /* ============================================================ */
            /* - Notify Homey the network connection is disconneted.        */
            /* - Try to reconnect again.                                    */
            /* ============================================================ */
            _this._d("Network timed out.");
            _this.comChannel.emit("net_timed_out", _this.avr_avrnum, _this.avr_name);
            _this.eventch.emit("net_retry");
        })
            .on("net_retry", function () {
            _this._d("Network retry.");
            setTimeout(function () {
                if (_this.hasToStop === false) {
                    _this._openConnection();
                }
            }, TIME_TO_RETRY);
        })
            .on("req_disconnect", function () {
            _this._d("Request disconnect.");
            _this.hasToStop = true;
            if (_this.avrSocket !== null) {
                _this.avrSocket.end();
            }
        })
            .on("new_data", function () {
            if (_this.isBufferLoopRunning === false) {
                _this.isBufferLoopRunning = true;
                _this._checkSendBuffer();
            }
        })
            .on("check_buffer", function () {
            _this._checkSendBuffer();
        })
            .on("uncaughtException", function (err) {
            _this.comChannel.emit("net_uncaught", _this.avr_avrnum, _this.avr_name);
            _this.avrSocket.end();
            _this.eventch.emit("net_retry");
        });
    };
    /**
     * Connects to the AVR ans sets listeners on the possible connection events.
     * @private
     */
    AVR.prototype._openConnection = function () {
        var _this = this;
        this._d("Opening AVR network connection to '" + this.avr_host + ":" + this.avr_port + "'.");
        /* ================================================================ */
        /* - Use allowHalfOpen to create a permanent connection to the AVR  */
        /* - over the network otherwise the connection will terminate as    */
        /* - soon as the socket buffer is empty.                            */
        /* ================================================================ */
        this.avrSocket = new net.Socket({
            allowHalfOpen: true
        });
        this.avrSocket.connect(this.avr_port, this.avr_host);
        this.avrSocket
            .on("connect", function () {
            _this._d("Connected");
            _this.eventch.emit("net_connected");
        })
            .on("error", function (err) {
            _this._d("Network error");
            _this.hasNetworkConnection = false;
            _this.avrSocket.end();
            _this.avrSocket = null;
            _this.eventch.emit("net_error", err);
        })
            .on("data", function (data) {
            _this._d("data");
            _this._processData(data);
        })
            .on("end", function () {
            _this._d("Disconnected");
            _this.hasNetworkConnection = false;
            _this.avrSocket.end();
            _this.avrSocket = null;
            _this.eventch.emit("net_disconnected");
        })
            .on("timeout", function () {
            _this._d("timed out.");
            _this.hasNetworkConnection = false;
            _this.avrSocket.end();
            _this.avrSocket = null;
            _this.eventch.emit("net_timed_out");
        })
            .on("uncaughtException", function (err) {
            _this._d("UncaughtException " + err);
            _this.hasNetworkConnection = false;
            _this.avrSocket.end();
            _this.avrSocket = null;
            _this.eventch.emit("net_error", new Error("uncaught exception - " + err + "."));
        });
    };
    AVR.prototype._checkSendBuffer = function () {
        this._d("_checkSendBuffer: " + this.insertIndex + " / " + this.deleteIndex);
        if (this.insertIndex === this.deleteIndex) {
            /* ============================================================= */
            /* - Send buffer is empty => nothing to do till new data is      */
            /* - entered into the send buffer.                               */
            /* ============================================================= */
            this.isBufferLoopRunning = false;
            this._d("Send buffer loop stopped - send buffer empty.");
        }
        else {
            if (this.sendBuffer[this.deleteIndex] === "") {
                /* =========================================================== */
                /* - If the command to be send is empty, consider it as        */
                /* - buffer empty and exit the buffer loop.                    */
                /* =========================================================== */
                this.isBufferLoopRunning = false;
                this._d("Send buffer loop stopped - command empty.");
            }
            else {
                var data = this.sendBuffer[this.deleteIndex];
                this.sendBuffer[this.deleteIndex] = "";
                this.deleteIndex++;
                if (this.deleteIndex >= MAX_INDEX) {
                    this.deleteIndex = 0;
                }
                this._d("Setting deleteIndex to " + this.deleteIndex + ".");
                this._sendToAvr(data);
            }
        }
    };
    /**
     * Sends to command to the AVR.
     * It will add a '\r' as required by Marantz.
     * The AVR requires approx 50-70 msec between consecutive commands.
     *
     * @param {string} cmd The command string
     * @private
     */
    AVR.prototype._sendToAvr = function (cmd) {
        var _this = this;
        this._d("Sending: " + cmd + ".");
        this.avrSocket.write(cmd + "\r");
        setTimeout(function () {
            _this.eventch.emit("check_buffer");
        }, WAIT_BETWEEN_TRANSMITS);
    };
    /**
     * Insert a command into the send buffer.
     * Updates the insertIndex and start a send buffer loop,
     * @param  {string} cmd  the command string
     * @private
     */
    AVR.prototype._insertIntoSendBuffer = function (cmd) {
        var nextInsertIndex = this.insertIndex + 1;
        if (nextInsertIndex >= MAX_INDEX) {
            nextInsertIndex = 0;
        }
        if (nextInsertIndex === this.deleteIndex) {
            /* ============================================================== */
            /* - Data buffer overrun !.                                       */
            /* - Notify Homey part but dont insert                            */
            /* ============================================================== */
            this.comChannel.emit("error_log", this.avr_avrnum, this.avr_name, new Error("Send buffer overrun !."));
        }
        else {
            this.sendBuffer[this.insertIndex] = cmd;
            this.insertIndex = nextInsertIndex;
            this._d("InsertIndex set to " + this.insertIndex + ".");
            this.eventch.emit("new_data");
        }
    };
    AVR.prototype._processData = function (data) {
        var xData = data.toString("utf8").replace("\r", "");
        this._d("Received : '" + xData + "'.");
        var newStatus = "";
        var oldStatus = "";
        var newi18n = "";
        var oldi18n = "";
        /* ============================================================== */
        /* - Note:                                                        */
        /* -  Report changes to the Homey part only if there is a         */
        /* -  network connection with the AVR.                            */
        /* ============================================================== */
        switch (xData.substr(0, 2)) {
            case "PW":
                /* ========================================================== */
                /* - Main Power                                               */
                /* ========================================================== */
                newStatus = xData;
                oldStatus = this.powerStatus;
                newi18n = "";
                oldi18n = "";
                this.powerStatus = newStatus;
                if (this.hasNetworkConnection === true &&
                    newStatus !== oldStatus) {
                    for (var I = 0; I < this.conf.power.length; I++) {
                        if (newStatus === this.conf.power[I].command) {
                            newi18n = this.conf.power[I].i18n;
                        }
                    }
                    for (var I = 0; I < this.conf.power.length; I++) {
                        if (oldStatus === this.conf.power[I].command) {
                            oldi18n = this.conf.power[I].i18n;
                        }
                    }
                    this.comChannel.emit("power_status_chg", this.avr_avrnum, this.avr_name, newi18n, oldi18n);
                }
                break;
            case "ZM":
                /* ========================================================== */
                /* - Main Zone Power                                          */
                /* ========================================================== */
                newStatus = xData;
                oldStatus = this.mainZonePowerStatus;
                newi18n = "";
                oldi18n = "";
                this.mainZonePowerStatus = xData;
                if (this.hasNetworkConnection === true &&
                    newStatus !== oldStatus) {
                    for (var I = 0; I < this.conf.main_zone_power.length; I++) {
                        if (newStatus === this.conf.main_zone_power[I].command) {
                            newi18n = this.conf.main_zone_power[I].i18n;
                        }
                    }
                    for (var I = 0; I < this.conf.main_zone_power.length; I++) {
                        if (oldStatus === this.conf.main_zone_power[I].command) {
                            oldi18n = this.conf.main_zone_power[I].i18n;
                        }
                    }
                    this.comChannel.emit("mzpower_status_chg", this.avr_avrnum, this.avr_name, newi18n, oldi18n);
                }
                break;
            case "SI":
                /* ========================================================== */
                /* - Input Source selection                                   */
                /* ========================================================== */
                newStatus = xData;
                oldStatus = this.inputSourceSelection;
                newi18n = "";
                oldi18n = "";
                this.inputSourceSelection = xData;
                if (this.hasNetworkConnection === true &&
                    newStatus !== oldStatus) {
                    for (var I = 0; I < this.conf.inputsource.length; I++) {
                        if (newStatus === this.conf.inputsource[I].command) {
                            newi18n = this.conf.inputsource[I].i18n;
                        }
                    }
                    for (var I = 0; I < this.conf.inputsource.length; I++) {
                        if (oldStatus === this.conf.inputsource[I].command) {
                            oldi18n = this.conf.inputsource[I].i18n;
                        }
                    }
                    this.comChannel.emit("isource_status_chg", this.avr_avrnum, this.avr_name, newi18n, oldi18n);
                }
                break;
            case "MU":
                /* ========================================================== */
                /* - mute                                                     */
                /* ========================================================== */
                newStatus = xData;
                oldStatus = this.muteStatus;
                newi18n = "";
                oldi18n = "";
                this.muteStatus = xData;
                if (this.hasNetworkConnection === true &&
                    newStatus !== oldStatus) {
                    for (var I = 0; I < this.conf.mute.length; I++) {
                        if (newStatus === this.conf.mute[I].command) {
                            newi18n = this.conf.mute[I].i18n;
                        }
                    }
                    for (var I = 0; I < this.conf.mute.length; I++) {
                        if (oldStatus === this.conf.mute[I].command) {
                            oldi18n = this.conf.mute[I].i18n;
                        }
                    }
                    this.comChannel.emit("mute_status_chg", this.avr_avrnum, this.avr_name, newi18n, oldi18n);
                }
                break;
            case "MS":
                /* ========================================================== */
                /* - Surround mode                                            */
                /* ========================================================== */
                newStatus = xData;
                oldStatus = this.surroundMode;
                newi18n = "";
                oldi18n = "";
                this.surroundMode = xData;
                if (this.hasNetworkConnection === true &&
                    newStatus !== oldStatus) {
                    for (var I = 0; I < this.conf.surround.length; I++) {
                        if (newStatus === this.conf.surround[I].command) {
                            newi18n = this.conf.surround[I].i18n;
                        }
                    }
                    for (var I = 0; I < this.conf.surround.length; I++) {
                        if (oldStatus === this.conf.surround[I].command) {
                            oldi18n = this.conf.surround[I].i18n;
                        }
                    }
                    this.comChannel.emit("surround_status_chg", this.avr_avrnum, this.avr_name, newi18n, oldi18n);
                }
                break;
            case "MV":
                /* ========================================================== */
                /* - Volume                                                   */
                /* ========================================================== */
                this._processVolume(xData);
                break;
            case "EC":
                /* ========================================================== */
                /* - Eco mode                                                 */
                /* ========================================================== */
                newStatus = xData;
                oldStatus = this.ecoStatus;
                newi18n = "";
                oldi18n = "";
                this.ecoStatus = xData;
                if (this.hasNetworkConnection === true &&
                    newStatus !== oldStatus) {
                    for (var I = 0; I < this.conf.eco.length; I++) {
                        if (newStatus === this.conf.eco[I].command) {
                            newi18n = this.conf.eco[I].i18n;
                        }
                    }
                    for (var I = 0; I < this.conf.eco.length; I++) {
                        if (oldStatus === this.conf.eco[I].command) {
                            oldi18n = this.conf.eco[I].i18n;
                        }
                    }
                    this.comChannel.emit("eco_status_chg", this.avr_avrnum, this.avr_name, newi18n, oldi18n);
                }
                break;
        }
    };
    /**
     * Processes the volume status strng from the AVR.
     * @param {string} volume The volume status.
     * @private
     */
    AVR.prototype._processVolume = function (volume) {
        this._d("Processing Volume: " + volume + ".");
        if (volume.match(/^MVMAX .*/) == null) {
            this._d("Setting volume status to " + volume + ".");
            this.volumeStatus = volume;
            var re = /^MV(\d+)/i;
            var Ar = volume.match(re);
            if (Ar !== null) {
                this.comChannel.emit("volume_status_chg", this.avr_avrnum, this.avr_name, Ar[1]);
            }
        }
    };
    /**
     * Get the status fromthe AVR once the network coonction is established
     * @private
     */
    AVR.prototype._getAVRstatusUpdate = function () {
        this._getAvrPowerStatus();
        this._getAvrMainZonePowerStatus();
        this._getAvrInputSourceSelection();
        this._getAvrMuteStatus();
        this._getAvrVolumeStatus();
        this._getAvrSurroundMode();
        this._getAvrEcoStatus();
    };
    /* ================================================================== */
    /* - Debug methods                                                    */
    /* ================================================================== */
    /**
     * Enable debug output messages to console.
     */
    AVR.prototype.setConsoleToDebug = function () {
        this.consoleOut = true;
        this._d("AVR debug switch on.");
    };
    AVR.prototype.setConsoleOff = function () {
        this._d("AVR debug switch off.");
        this.consoleOut = false;
    };
    /**
     * Override avr type filtering (testing only!.)
     * @private
     */
    AVR.prototype.setTest = function () {
        this.filter = false;
    };
    /**
     * Return to standard filtering mode (testing only!)
     * @private
     */
    AVR.prototype.clearTest = function () {
        this.filter = false;
    };
    /**
     * Send (conditionally) a debug message to console.log (debug only!)
     * @private
     * @param {string} str the debug message.
     */
    AVR.prototype._d = function (str) {
        if (this.consoleOut === true) {
            this.comChannel.emit("debug_log", this.avr_avrnum, this.avr_name, str);
        }
    };
    /* ================================================================== */
    /* - get AVR initial parameters                                       */
    /* ================================================================== */
    /**
     * Get the current hostname
     * @return {string} The hostname or IP address.
     */
    AVR.prototype.getHostname = function () {
        return this.avr_host;
    };
    /**
     * Get the current port number
     * @return {number} The current port number.
     */
    AVR.prototype.getPort = function () {
        return this.avr_port;
    };
    /**
     * Get the current AVR type.
     * @return {string} The current AVR type.
     */
    AVR.prototype.getType = function () {
        return this.avr_type;
    };
    /**
     * Get the current home name of the AVR.
     * @return {string} The current name.
     */
    AVR.prototype.getName = function () {
        return this.avr_name;
    };
    /**
     * Get the internal indev/
     * @return {number} The internal index
     */
    AVR.prototype.getNum = function () {
        return this.avr_avrnum;
    };
    /**
     * Is the AVR configuration loaded?
     * @return {boolean} true => loaded, false => not loaded.
     */
    AVR.prototype.isConfigLoaded = function () {
        return this.hasConfigLoaded;
    };
    /* ================================================================== */
    /* - Public non AVR commands                                          */
    /* ================================================================== */
    /**
     * Disconnect on request of the user or Homey.
     */
    AVR.prototype.disconnect = function () {
        this._d("Disconnecting on request.");
        this.eventch.emit("req_disconnect");
    };
    /* ================================================================== */
    /* - Power methods                                                    */
    /* ================================================================== */
    /**
     * Find the command of the requested power action and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._powerCommand = function (cmd) {
        for (var I = 0; I < this.conf.power.length; I++) {
            if (this.filter == false) {
                if (this.conf.power[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.power[I].command);
                }
            }
            else {
                if (this.conf.power[I].prog_id === cmd &&
                    this.conf.power[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.power[I].command);
                }
            }
        }
    };
    /**
     * Switch on the power of the AVR
     */
    AVR.prototype.powerOn = function () {
        this._powerCommand("power_on");
    };
    /**
     * Switch the AVR power off / standby.
     */
    AVR.prototype.powerOff = function () {
        this._powerCommand("power_off");
    };
    /**
     * Request power status from the AVR.
     * @private
     */
    AVR.prototype._getAvrPowerStatus = function () {
        this._powerCommand("power_request");
    };
    /**
     * Get the i18n current power status.
     * @return {string} The i18n current power status string
     */
    AVR.prototype.getPoweri18nStatus = function () {
        var retStr = "error.cmdnf";
        for (var I = 0; I < this.conf.power.length; I++) {
            if (this.powerStatus === this.conf.power[I].command) {
                retStr = this.conf.power[I].i18n;
                break;
            }
        }
        return retStr;
    };
    /**
     * Get the boolean power status. (true => power on, false => power off).
     * @return {boolean} Power status.
     */
    AVR.prototype.getPowerOnOffState = function () {
        for (var I = 0; I < this.conf.power.length; I++) {
            if (this.conf.power[I].prog_id === "power_on") {
                if (this.conf.power[I].command === this.powerStatus) {
                    return true;
                }
                else {
                    return false;
                }
            }
        }
    };
    /* ================================================================== */
    /* - Main zone power methods                                          */
    /* ================================================================== */
    /**
     * Find the command of the requested main zone power action
     * and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._mainZonepowerCommand = function (cmd) {
        for (var I = 0; I < this.conf.main_zone_power.length; I++) {
            if (this.filter == false) {
                if (this.conf.main_zone_power[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.main_zone_power[I].command);
                }
            }
            else {
                if (this.conf.main_zone_power[I].prog_id === cmd &&
                    this.conf.main_zone_power[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.main_zone_power[I].command);
                }
            }
        }
    };
    /**
     * Switch on the main zone power of the AVR
     */
    AVR.prototype.mainZonePowerOn = function () {
        this._mainZonepowerCommand("mzpower_on");
    };
    /**
     * Switch the AVR main zone power off / standby.
     */
    AVR.prototype.mainZonePowerOff = function () {
        this._mainZonepowerCommand("mzpower_off");
    };
    /**
     * Request main zone power status from the AVR.
     * @private
     */
    AVR.prototype._getAvrMainZonePowerStatus = function () {
        this._mainZonepowerCommand("mzpower_request");
    };
    /**
     * Get the i18n current power status.
     * @return {string} The i18n current power status string
     */
    AVR.prototype.getMainZonePoweri18nStatus = function () {
        var retStr = "error.cmdnf";
        for (var I = 0; I < this.conf.main_zone_power.length; I++) {
            this._d(this.mainZonePowerStatus + " <> " + this.conf.main_zone_power[I].command + ".");
            if (this.mainZonePowerStatus === this.conf.main_zone_power[I].command) {
                retStr = this.conf.main_zone_power[I].i18n;
                break;
            }
        }
        return retStr;
    };
    /**
     * Get the boolean main zone power status. (true => power on, false => power off).
     * @return {boolean} Power status.
     */
    AVR.prototype.getMainZonePowerOnOffState = function () {
        for (var I = 0; I < this.conf.main_zone_power.length; I++) {
            if (this.conf.main_zone_power[I].prog_id === "mzpower_on") {
                if (this.conf.main_zone_power[I].command === this.mainZonePowerStatus) {
                    return true;
                }
            }
        }
        return false;
    };
    /* ================================================================== */
    /* - Mute methods                                                     */
    /* ================================================================== */
    /**
     * Find the command of the requested mute action
     * and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._muteCommand = function (cmd) {
        for (var I = 0; I < this.conf.mute.length; I++) {
            if (this.filter == false) {
                if (this.conf.mute[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.mute[I].command);
                }
            }
            else {
                if (this.conf.mute[I].prog_id === cmd &&
                    this.conf.mute[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.mute[I].command);
                }
            }
        }
    };
    /**
     * Switch mute on.
     */
    AVR.prototype.muteOn = function () {
        this._muteCommand("mute_on");
    };
    /**
     * Switch mute off
     */
    AVR.prototype.muteOff = function () {
        this._muteCommand("mute_off");
    };
    /**
     * Get the current mute status from the AVR
     * @private
     */
    AVR.prototype._getAvrMuteStatus = function () {
        this._muteCommand("mute_request");
    };
    /**
     * Get the i18n current mute status.
     * @return {string} The i18n current mute status string
     */
    AVR.prototype.getMutei18nStatus = function () {
        var retStr = "error.cmdnf";
        for (var I = 0; I < this.conf.mute.length; I++) {
            if (this.muteStatus === this.conf.mute[I].command) {
                retStr = this.conf.mute[I].i18n;
                break;
            }
        }
        return retStr;
    };
    /**
     * Get the boolean mute status. (true => on, false => off).
     * @return {boolean} Mute status.
     */
    AVR.prototype.getMuteOnOffState = function () {
        for (var I = 0; I < this.conf.mute.length; I++) {
            if (this.conf.mute[I].prog_id === "mute_on") {
                if (this.conf.mute[I].command === this.muteStatus) {
                    return true;
                }
            }
        }
        return false;
    };
    /* ================================================================== */
    /* - InputSource methods                                                     */
    /* ================================================================== */
    /**
     * Find the command of the requested inputsource action
     * and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._inputSourceCommand = function (cmd) {
        for (var I = 0; I < this.conf.inputsource.length; I++) {
            if (this.filter == false) {
                if (this.conf.inputsource[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.inputsource[I].command);
                }
            }
            else {
                if (this.conf.inputsource[I].prog_id === cmd &&
                    this.conf.inputsource[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.inputsource[I].command);
                }
            }
        }
    };
    /**
     * Get the supported input selection for the AVR type.
     * @return {string[]}  Array (i18n,command) of the supported sources.
     */
    AVR.prototype.getValidInputSelection = function () {
        return this.selAr;
    };
    /**
     * Select given input Source.
     * @param {string} command_id The input source command.
     */
    AVR.prototype.selectInputSource = function (command) {
        this._insertIntoSendBuffer(command);
    };
    /**
     * Select Phono as inputsource.
     */
    AVR.prototype.selectInputSourcePhono = function () {
        this._inputSourceCommand("i_phono");
    };
    /**
     * Select CD as input source.
     */
    AVR.prototype.selectInputSourceCd = function () {
        this._inputSourceCommand("i_cd");
    };
    /**
     * Select DVD as input source.
     */
    AVR.prototype.selectInputSourceDvd = function () {
        this._inputSourceCommand("i_dvd");
    };
    /**
     * Select Bluray as input source
     */
    AVR.prototype.selectInputSourceBluray = function () {
        this._inputSourceCommand("i_bd");
    };
    /**
     * Select TV as input source
     */
    AVR.prototype.selectInputSourceTv = function () {
        this._inputSourceCommand("i_tv");
    };
    /**
     * Select SAT/CBL as input source.
     */
    AVR.prototype.selectInputSourceSatCbl = function () {
        this._inputSourceCommand("i_sat_cbl");
    };
    /**
     * Select SAT as input source.
     */
    AVR.prototype.selectInputSourceSat = function () {
        this._inputSourceCommand("i_sat");
    };
    /**
     * Select MPlay as input source
     */
    AVR.prototype.selectInputSourceMplay = function () {
        this._inputSourceCommand("i_mplay");
    };
    /**
     * Select VCR as input source.
     */
    AVR.prototype.selectInputSourceVcr = function () {
        this._inputSourceCommand("i_vcr");
    };
    /**
     * Select GAME as input source
     */
    AVR.prototype.selectInputSourceGame = function () {
        this._inputSourceCommand("i_game");
    };
    /**
     * Select V-AUX as input source
     */
    AVR.prototype.selectInputSourceVaux = function () {
        this._inputSourceCommand("i_vaux");
    };
    /**
     * Select TUNER as input source
     */
    AVR.prototype.selectInputSourceTuner = function () {
        this._inputSourceCommand("i_tuner");
    };
    /**
     * Select Spotify as input source.
     */
    AVR.prototype.selectInputSourceSpotify = function () {
        this._inputSourceCommand("i_spotify");
    };
    /**
     * Select Napster as input source.
     */
    AVR.prototype.selectInputSourceNapster = function () {
        this._inputSourceCommand("i_napster");
    };
    /**
     * Select FLICKR as input source.
     */
    AVR.prototype.selectInputSourceFlickr = function () {
        this._inputSourceCommand("i_flickr");
    };
    /**
     * Select Internet Radio as input source.
     */
    AVR.prototype.selectInputSourceIradio = function () {
        this._inputSourceCommand("i_iradio");
    };
    /**
     * Seletc Favorites aas input source.
     */
    AVR.prototype.selectInputSourceFavorites = function () {
        this._inputSourceCommand("i_favorites");
    };
    /**
     * Select AUX1 as input source/
     */
    AVR.prototype.selectInputSourceAux1 = function () {
        this._inputSourceCommand("i_aux1");
    };
    /**
     * Select AUX2 as input source/
     */
    AVR.prototype.selectInputSourceAux2 = function () {
        this._inputSourceCommand("i_aux2");
    };
    /**
     * Select AUX3 as input source/
     */
    AVR.prototype.selectInputSourceAux3 = function () {
        this._inputSourceCommand("i_aux3");
    };
    /**
     * Select AUX4 as input source/
     */
    AVR.prototype.selectInputSourceAux4 = function () {
        this._inputSourceCommand("i_aux4");
    };
    /**
     * Select AUX5 as input source/
     */
    AVR.prototype.selectInputSourceAux5 = function () {
        this._inputSourceCommand("i_aux5");
    };
    /**
     * Select AUX6 as input source/
     */
    AVR.prototype.selectInputSourceAux6 = function () {
        this._inputSourceCommand("i_aux6");
    };
    /**
     * Select AUX7 as input source/
     */
    AVR.prototype.selectInputSourceAux7 = function () {
        this._inputSourceCommand("i_aux7");
    };
    /**
     * Select Net/USB as input source.
     */
    AVR.prototype.selectInputSourceNetUsb = function () {
        this._inputSourceCommand("i_net_usb");
    };
    /**
     * Select NET as input source.
     */
    AVR.prototype.selectInputSourceNet = function () {
        this._inputSourceCommand("i_net");
    };
    /**
     * Select Blutooth as input source.
     */
    AVR.prototype.selectInputSourceBluetooth = function () {
        this._inputSourceCommand("i_bt");
    };
    /**
     * Select MXport as input source.
     */
    AVR.prototype.selectInputSourceMxport = function () {
        this._inputSourceCommand("i_mxport");
    };
    /**
     * Select USB/IPOD as input source.
     */
    AVR.prototype.selectInputSourceUsbIpod = function () {
        this._inputSourceCommand("i_usb_ipod");
    };
    /**
     * Get the current input source selection from the AVR.
     * @private
     */
    AVR.prototype._getAvrInputSourceSelection = function () {
        this._inputSourceCommand("i_request");
    };
    AVR.prototype.getInputSourceI18n = function () {
        var retStr = "error.cmdnf";
        for (var I = 0; I < this.conf.inputsource.length; I++) {
            if (this.inputSourceSelection === this.conf.inputsource[I].command) {
                retStr = this.conf.inputsource[I].i18n;
                break;
            }
        }
        return retStr;
    };
    /* ================================================================== */
    /* - Volume methods                                                   */
    /* ================================================================== */
    /**
     * Find the command of the requested volume action
     * and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._volumeCommand = function (cmd, level) {
        var levelStr = "";
        if (level !== -1) {
            levelStr = level.toString();
        }
        for (var I = 0; I < this.conf.volume.length; I++) {
            if (this.filter == false) {
                if (this.conf.volume[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.volume[I].command + ("" + levelStr));
                }
            }
            else {
                if (this.conf.volume[I].prog_id === cmd &&
                    this.conf.volume[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.volume[I].command + ("" + levelStr));
                }
            }
        }
    };
    /**
     * Increase volume
     */
    AVR.prototype.volumeUp = function () {
        this._volumeCommand("volume_up", -1);
    };
    /**
     * Decrease volume.
     */
    AVR.prototype.volumeDown = function () {
        this._volumeCommand("volume_down", -1);
    };
    /**
     * Set volume to 'level'.
     * @param {number} level New volume level.
     */
    AVR.prototype.setVolume = function (level) {
        if (level >= 0 && level < MAX_VOLUME) {
            this._volumeCommand("volume_set", level);
        }
    };
    /**
     * Get the current volume setting from the AVR
     * @private
     */
    AVR.prototype._getAvrVolumeStatus = function () {
        this._volumeCommand("volume_request", -1);
    };
    /**
     * Get the current volume setting if known otherwise "_unknown_".
     * @return {string} The volume.
     */
    AVR.prototype.getVolume = function () {
        this._d("volume is " + this.volumeStatus + ".");
        var re = /^MV(\d+)/i;
        var Ar = this.volumeStatus.match(re);
        if (Ar !== null) {
            return Ar[1];
        }
        else {
            return "_unknown_";
        }
    };
    /* ================================================================== */
    /* - Surround methods                                                 */
    /* ================================================================== */
    /**
     * Find the command of the requested surround action
     * and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._surroundCommand = function (cmd) {
        for (var I = 0; I < this.conf.surround.length; I++) {
            if (this.filter == false) {
                if (this.conf.surround[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.surround[I].command);
                }
            }
            else {
                if (this.conf.surround[I].prog_id === cmd &&
                    this.conf.surround[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.surround[I].command);
                }
            }
        }
    };
    /**
     * Get the support surround commands for th AVR type.
     * @return {SelectionInfo[]} The supported surround command array.
     */
    AVR.prototype.getValidSurround = function () {
        return this.surroundAr;
    };
    /**
     * Set surround mode to "command".
     * @param {string} command The diesired surround mode.
     */
    AVR.prototype.setSurrroundCommand = function (command) {
        this._insertIntoSendBuffer(command);
    };
    /**
     * Set surround mode to "movies".
     */
    AVR.prototype.setSurroundModeToMovies = function () {
        this._surroundCommand("s_movie");
    };
    /**
     * Set surround mode to "music".
     */
    AVR.prototype.setSurroundModeToMusic = function () {
        this._surroundCommand("s_music");
    };
    /**
     * Set surround mode to 'game'.
     */
    AVR.prototype.setSurroundModeToGame = function () {
        this._surroundCommand("s_game");
    };
    /**
     * Set surround mode to 'direct'.
     */
    AVR.prototype.setSurroundModeToDirect = function () {
        this._surroundCommand("s_direct");
    };
    /**
     * Set surrond mode to 'pure-direct'.
     */
    AVR.prototype.setSurroundModeToPureDirect = function () {
        this._surroundCommand("s_pure");
    };
    /**
     * Set surround mode to "stereo".
     */
    AVR.prototype.setSurroundModeToStereo = function () {
        this._surroundCommand("s_stereo");
    };
    /**
     * Set surround mode to "auto".
     */
    AVR.prototype.setSurroundModeToAuto = function () {
        this._surroundCommand("s_auto");
    };
    /**
     * Set surround mode to 'neural'.
     */
    AVR.prototype.setSurroundModeToNeural = function () {
        this._surroundCommand("s_neural");
    };
    /**
     * Set surround mode  to "standard".
     */
    AVR.prototype.setSurroundModeToStandard = function () {
        this._surroundCommand("s_standard");
    };
    /**
     * Set surround mode to 'dolby'.
     */
    AVR.prototype.setSurroundModeToDolby = function () {
        this._surroundCommand("s_dobly");
    };
    /**
     * Set surround mode to "dts".
     */
    AVR.prototype.setSurroundModeToDts = function () {
        this._surroundCommand("s_dts");
    };
    /**
     * Set surround mode to "multi channel stereo".
     */
    AVR.prototype.setSurroundModeToMultiChannel = function () {
        this._surroundCommand("s_mchstereo");
    };
    /**
     * Set surround mode to "matrix".
     */
    AVR.prototype.setSurroundModeToMatrix = function () {
        this._surroundCommand("s_matrix");
    };
    /**
     * Set surround mode to "virtual".
     */
    AVR.prototype.setSurroundModeToVirtual = function () {
        this._surroundCommand("s_virtual");
    };
    /**
     * Set surround mode to "left".
     */
    AVR.prototype.setSurroundModeToLeft = function () {
        this._surroundCommand("s_left");
    };
    /**
     * Set surround mode to 'right'.
     */
    AVR.prototype.setSurroundModeToRight = function () {
        this._surroundCommand("s_right");
    };
    /**
     * Get the current surround mode from the AVR.
     * $private
     */
    AVR.prototype._getAvrSurroundMode = function () {
        this._surroundCommand("s_request");
    };
    /**
     * Get the i18n surround mode text.
     * @return {string} The i18n string.
     */
    AVR.prototype.geti18nSurroundMode = function () {
        var retStr = "error.cmdnf";
        for (var I = 0; I < this.conf.surround.length; I++) {
            if (this.surroundMode === this.conf.surround[I].command) {
                retStr = this.conf.surround[I].i18n;
                break;
            }
        }
        return retStr;
    };
    /* ================================================================== */
    /* - Eco methods                                                      */
    /* ================================================================== */
    /**
     * Find the command of the requested eco action
     * and send it to the AVR.
     * @param {string} cmd The "prog_id" string of the requested command.
     * @private
     */
    AVR.prototype._ecoCommand = function (cmd) {
        for (var I = 0; I < this.conf.eco.length; I++) {
            if (this.filter == false) {
                if (this.conf.eco[I].prog_id === cmd) {
                    this._insertIntoSendBuffer(this.conf.eco[I].command);
                }
            }
            else {
                if (this.conf.eco[I].prog_id === cmd &&
                    this.conf.eco[I].valid === true) {
                    this._insertIntoSendBuffer(this.conf.eco[I].command);
                }
            }
        }
    };
    /**
     * Get the supported eco modes of the AVR type.
     * @return {SelectionInfo[]} The supported eco command.
     */
    AVR.prototype.getValidEcoModes = function () {
        return this.ecoAr;
    };
    /**
     * Send a eco command to the AVR.
     * @param {string} command The eco command
     */
    AVR.prototype.sendEcoCommand = function (command) {
        if (command !== "eco_not_supported") {
            this._insertIntoSendBuffer(command);
        }
        else {
            this._d("Eco is not supported for this type.");
        }
    };
    /**
     * Check if this type supports eco commands (true=> yes, false=> no)
     * @return {boolean} The eco support status.
     */
    AVR.prototype.hasEco = function () {
        if (this.conf.eco[0].valid === true) {
            return true;
        }
        else {
            return false;
        }
    };
    /**
     * Switch eco mode on.
     */
    AVR.prototype.ecoOn = function () {
        if (this.hasEco() === true) {
            this._ecoCommand("eco_on");
        }
    };
    /**
     * Switch eco mode off.
     */
    AVR.prototype.ecoOff = function () {
        if (this.hasEco() === true) {
            this._ecoCommand("eco_off");
        }
    };
    /**
     * Switch eco mode to auto.
     */
    AVR.prototype.ecoAuto = function () {
        if (this.hasEco() === true) {
            this._ecoCommand("eco_auto");
        }
    };
    /**
     * Get the current eco Mode from the AVR.
     */
    AVR.prototype._getAvrEcoStatus = function () {
        if (this.hasEco() === true) {
            this._ecoCommand("eco_request");
        }
    };
    AVR.prototype.geti18nEcoMode = function () {
        var retStr = "error.cmdnf";
        for (var I = 0; I < this.conf.eco.length; I++) {
            if (this.ecoStatus === this.conf.eco[I].command) {
                retStr = this.conf.eco[I].i18n;
                break;
            }
        }
        return retStr;
    };
    return AVR;
}());
exports.AVR = AVR;
//# sourceMappingURL=avr.js.map