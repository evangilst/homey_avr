"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var net = require("net");
var fs = require("fs");
var path = require("path");
var eventEmitter = require("events");

var TIME_TO_RETRY = 10000; // === 10 sec
// Time to wait before re-open a new
// connection to the AVR will take place.
var WAIT_BETWEEN_TRANSMITS = 100; // === 100 msec
// Wait time between two consecutive
// command transmissions.
// Marantz default is 50 msec or higher.

/**
 * Class AVR
 */

var Avr = (function () {

    /**
     * Create a new AVR Object.
     */

    function Avr() {
        _classCallCheck(this, Avr);

        this.avrPort = 0; // Network port to use
        this.avrHost = ""; // IP address or hostname to use
        this.avrName = ""; // Given name within Homry
        this.avrType = ""; // Type of AVR to be used
        this.avrNum = -1; // Internal index
        this.conChn = null; // Event channel to communicate with the
        // Homey part of the application (driver.js)
        this.errMsg = "";
        this.conf = null; // Will hold avr type configuration data
        this.selAr = []; // Array with possible input source device
        this.surroundAr = []; // Array with possible surround modes
        this.ecoAr = []; // Array with possible eco modes
        this.sendAr = []; // the sendbuffer
        this.insertIndex = 0; // Send index of the sendbuffer.
        this.deleteIndex = 0; // Delete index of the sendbuffer
        this.MAXINDEX = 64; // Max commands in the sendbuffer
        this.socket = null;
        this.test = 0; // Test indicator,
        // lifts some restrictions during testing.
        this.consoleOut = 0; // 0 = no output
        // 1 = debug

        // Internal process state vars.
        this.isLoopRunning = false;
        this.hasToStop = false;
        this.hasConfigloaded = false;
        this.hasNetworkConnection = false;

        // Initial parameter status of the AVR.
        // Will be updated by _processData
        this.powerStatus = "unknown";
        this.mainZonePowerStatus = "unknown";
        this.muteStatus = "unknown";
        this.inputSourceSelection = "unknown";
        this.volumeStatus = "unknown";
        this.surroundMode = "unknown";
        this.ecoStatus = "unknown";

        // initialize send Array.
        for (var I = 0; I <= this.MAXINDEX; I++) {
            this.sendAr[I] = "";
        }

        // internal event channel.
        this.server = new eventEmitter();
        // setup the internal event listeners
        this._eventloop();
    }

    /**
     * Initialize an AVR.
     *
     * @param      {number}  sPort   The network port to use.
     * @param      {string}  sHost   The ip address of the AVR
     * @param      {string}  sName   The name of the AVR
     * @param      {string}  sType   The type of the AVR
     * @param      {number}  sNum    The index into the AVR array (internal)
     * @param      {socket}  sChannel The event socket
     */

    _createClass(Avr, [{
        key: "init",
        value: function init(sPort, sHost, sName, sType, sNum, sChannel) {
            var _this = this;

            this.avrPort = sPort;
            this.avrHost = sHost;
            this.avrName = sName;
            this.avrType = sType;
            this.avrNum = sNum;
            this.conChn = sChannel;

            //this._d(`Test: ${this.avrHost}:${this.avrPort} - ${this.avrName} `);

            // Get the correct configuration of the AVR type.

            this.avrConfigFile = path.join(__dirname, "/conf/" + this.avrType + ".json");
            this._d(this.avrConfigFile);

            fs.readFile(this.avrConfigFile, function (err, data) {

                if (err) {
                    _this.conf = null;
                    _this.hasConfigloaded = false;
                    _this.conChn.emit("init_failed", _this.avrNum, _this.avrType, err);
                    return;
                }

                try {
                    _this.conf = JSON.parse(data);
                } catch (err) {

                    _this.conf = null;
                    _this.hasConfigloaded = false;
                    _this.conChn.emit("init_failed", _this.avrNum, _this.avrType, err);
                    return;
                }

                _this.hasConfigloaded = true;

                // Fill the input selection array with the entries supported by the AVR type
                _this._fillSelectionArray();
                // Fill the surround selection array with the entries supported by the AVR type.
                _this._fillSurroundArray();
                // File the eco selection array with entries supported by the AVR.
                _this._fillEcoArray();

                _this.conChn.emit("init_success", _this.avrNum, _this.avrName, _this.avrType);
                _this.server.emit("config_loaded");
            });
        }

        /*********************************************************************
         * Private methods
         *********************************************************************/

        /**
         * EventLoop handles the avr control events
         * @private
         */

    }, {
        key: "_eventloop",
        value: function _eventloop() {
            var _this2 = this;

            this.server
            // 'config_loaded' event is send by 'init' after succesfull
            // loading and parsing the AVR config file.
            // next action: open network connection.
            .on("config_loaded", function () {
                _this2.configLoaded = true;
                _this2._openConnection();
            })

            // Network events all emitted by '_openConnection' depending
            // (except 'net_retry') on the received network events.
            // 'net_connect'    -> new connection established
            // 'net_disconnect' -> Disconnection request from the AVR
            // 'net_error'      -> Received net work errors.
            // 'net_timedout'   -> Network connection to the AVR has a timeout.
            // 'net_retry'      -> Try to connect again to the AVR.
            .on("net_connect", function () {
                // notify 'homey' part there is a connection
                // i.e make dev available

                _this2._getAVRStatusUpdate(); // get the status of the new AVR

                // Wait 2 sec before informing homey so the status of the AVR
                // can be collected.
                // Set hasNetworkConnection after the the wait time so the
                // above initial status requests don't cause events
                setTimeout(function () {
                    _this2.hasNetworkConnection = true;
                    _this2.conChn.emit("net_connected", _this2.avrNum, _this2.avrName);
                }, 2000);
            }).on("net_disconnect", function () {
                // notify 'homey' part connection is disconnected
                // i.e make dev unavailable
                _this2.conChn.emit("net_disconnected", _this2.avrNum, _this2.avrName);
                _this2.server.emit("net_retry"); // connect again.
            }).on("net_error", function (err) {
                // notify 'homey' part connection is disconnected
                // i.e make dev unavailable
                _this2.conChn.emit("net_error", _this2.avrNum, _this2.avrName, err);
                _this2.server.emit("net_retry"); // connect again.
            }).on("net_timed_out", function () {
                // notify 'homey' part connection is disconnected
                // i.e make dev unavailable
                _this2.conChn.emit("net_timed_out", _this2.avrNum, _this2.avrName);
                _this2.server.emit("net_retry"); // connect again.
            }).on("net_retry", function () {
                // Don't start the action if a request to stop is received.
                // hasToStop will be set by 'disconnect' function.
                if (_this2.hasToStop === false) {
                    setTimeout(function () {
                        _this2._openConnection();
                    }, TIME_TO_RETRY);
                }
            })
            // Disconnect request from user/Homey
            .on("req_disconnect", function () {
                _this2.hasToStop = true;
                _this2.socket.end();
            })

            // send buffer events.
            // 'send_command' event occurs when
            //    1) the send buffer is filled with a new command (_insertIntoSendBuffer)
            //    2) After a command is send to the AVR.
            //       To check if the buffer is no empty. (_insertIntoSendBufferToAvr).

            .on("new_data", function () {
                // New commands are added to the send buffer.
                // start the send loop only once
                // will be reset as soon the send buffer runs out of new data.
                if (_this2.isLoopRunning === false) {
                    _this2.isLoopRunning = true;
                    _this2._checkSendBuffer(); // Send command to AVR.
                }
            }).on("check_buffer", function () {
                _this2._checkSendBuffer();
            })

            // catch uncaught exception to prevent runtime problems.
            .on("uncaughtException", function (err) {
                _this2.conChn.emit("net_uncaught", _this2.avrNum, _this2.avrName, err);
            });
        }

        /**
         * Connects to the AVR and sets listeners on the possible connection events.
         *
         *  @private
         */
    }, {
        key: "_openConnection",
        value: function _openConnection() {
            var _this3 = this;

            this._d("Opening AVR network connection to " + this.avrHost + ":" + this.avrPort + ".");

            // Use allowHalfOpen to create a permanent connection to the AVR
            // over the network otherwise the connection will terminate asa soon
            // as the socket send buffer is empty.
            this.socket = new net.Socket({
                allowHalfOpen: true
            });

            this.socket.connect(this.avrPort, this.avrHost).on("connect", function () {
                _this3.server.emit("net_connect");
            }).on("error", function (err) {
                _this3.hasNetworkConnection = false;
                _this3.socket.end();
                _this3.socket = null;
                _this3.server.emit("net_error", err);
            }).on("data", function (data) {
                _this3._processData(data);
            }).on("end", function () {
                _this3.hasNetworkConnection = false;
                _this3.socket.end();
                _this3.socket = null;
                _this3.server.emit("net_disconnect");
            }).on("timeout", function () {
                _this3.hasNetworkConnection = false;
                _this3.socket.end();
                _this3.socket = null;
                _this3.server.emit("net_timed_out");
            }).on("uncaughtException", function (err) {
                _this3.hasNetworkConnection = false;
                _this3.socket.end();
                _this3.socket = null;
                _this3.server.emit("net_error", new Error("uncaught exception - " + err + "."));
            });
        }

        /**
         * Sends a command to the avr.
         * It will automatically add a 'CR' to the command.
         * The AVR requires approx 50-60 msec between to consecutive commands.
         * The wait time between two commands is set by WAIT_BETWEEN_TRANSMITS (100msec)
         *
         * @param      {string}  cmd     The command to be send to the AVR
         * @private
         */
    }, {
        key: "_sendToAvr",
        value: function _sendToAvr(cmd) {
            var _this4 = this;

            this._d("Sending : " + cmd + ".");
            this.socket.write(cmd + "\r");

            setTimeout(function () {
                _this4.server.emit("check_buffer");
            }, WAIT_BETWEEN_TRANSMITS);
        }

        /**
         * Check the send buffer if there is something to be send.
         * if not:
         *     set isLoopRunning to false and wait on new data to be send
         *     by _insertIntoSendBuffer routine.
         *  if so:
         *      Update the deleteIndex and send data to the AVR.
         *
         * @private
         */
    }, {
        key: "_checkSendBuffer",
        value: function _checkSendBuffer() {

            this._d(this.insertIndex + " / " + this.deleteIndex + ".");

            if (this.insertIndex === this.deleteIndex) {

                // end buffer is 'empty' => nothing to do then wait till's flled again.
                this.isLoopRunning = false;
                this._d("Send loop temp stopped - empty send buffer.");
            } else {
                if (this.sendAr[this.deleteIndex] === "") {

                    // If the command to be send if empty consider it as
                    // empty buffer and exit the data send loop.
                    this.isLoopRunning = false;
                    this._d("Sendbuffer entry empty (stopping send loop)!.");
                } else {
                    var data = this.sendAr[this.deleteIndex];
                    this.sendAr[this.deleteIndex] = ""; // clear used buffer.
                    this.deleteIndex++;

                    if (this.deleteIndex >= this.MAXINDEX) {
                        this.deleteIndex = 0;
                    }
                    this._d("Setting deleteIndex to " + this.deleteIndex + ".");

                    this._sendToAvr(data);
                }
            }
        }

        /**
         * Inserts command data into the send buffer.
         * Updates the insertIndex and start the send data event loop.
         * If send buffer overrun occurs:
         *    1) drop the new commands
         *    2) notify Homey it occurred.
         *
         * @param      {string}  data    The command data.
         * @private
         */
    }, {
        key: "_insertIntoSendBuffer",
        value: function _insertIntoSendBuffer(data) {

            var nextInsertIndex = this.insertIndex + 1;

            if (nextInsertIndex >= this.MAXINDEX) {
                nextInsertIndex = 0;
            }

            if (this.nextInsertIndex === this.deleteIndex) {
                // data buffer overrun !
                this.conChn.emit("error_log", this.avrNum, this.avrName, new Error("send buffer overload !."));
            } else {

                this.sendAr[this.insertIndex] = data;

                this.insertIndex++;

                if (this.insertIndex >= this.MAXINDEX) {
                    this.insertIndex = 0;
                }

                this._d("Next insert index = " + this.insertIndex);

                // Signal there is new data in the send buffer.

                this.server.emit("new_data");
            }
        }

        /**
         * Creates an array with the supported inputsource selections for this AVR type.
         *
         *  @private
         */
    }, {
        key: "_fillSelectionArray",
        value: function _fillSelectionArray() {

            for (var I = 0; I < this.conf.inputsource.length; I++) {

                if (typeof this.conf.inputsource[I] !== "undefined" && this.conf.inputsource[I] !== null) {

                    if (this.conf.inputsource[I].valid === true && this.conf.inputsource[I].prog_id !== "i_request") {

                        var item = {};

                        item.i18n = this.conf.inputsource[I].i18n;
                        item.command = this.conf.inputsource[I].command;

                        this.selAr.push(item);
                    }
                }
            }
        }

        /**
         * Creates an array with supported surround selections for this AVR type .
         *
         *  @private
         */
    }, {
        key: "_fillSurroundArray",
        value: function _fillSurroundArray() {

            for (var I = 0; I < this.conf.surround.length; I++) {

                if (typeof this.conf.surround[I] !== "undefined" && this.conf.surround[I] !== null) {

                    if (this.conf.surround[I].valid === true && this.conf.surround[I].prog_id !== "s_request") {

                        var item = {};

                        item.i18n = this.conf.surround[I].i18n;
                        item.command = this.conf.surround[I].command;

                        this.surroundAr.push(item);
                    }
                }
            }
        }

        /**
         * Creates an array with the supported eco commands for this AVR type.
         * or
         * an array with 'not supported'.
         *
         *  @private
         */
    }, {
        key: "_fillEcoArray",
        value: function _fillEcoArray() {
            for (var I = 0; I < this.conf.eco.length; I++) {

                if (typeof this.conf.eco[I] !== "undefined" && this.conf.eco[I] !== null) {

                    if (this.conf.eco[I].valid === true && this.conf.eco[I].prog_id !== "eco_request") {

                        var item = {};

                        item.i18n = this.conf.eco[I].i18n;
                        item.command = this.conf.eco[I].command;

                        this.ecoAr.push(item);
                    }
                }
            }

            if (this.ecoAr.length === 0) {
                // Eco not supported for this type of AVR.

                var item = {};
                item.i18n = "eco.ns";
                item.command = "ECO_UN_SUPPORTED";

                this.ecoAr.push(item);
            }
        }

        /**
         * Process the received data from the AVR.
         * Is called when a 'data' network events is received.
         * Note:
         *     there is a 2 sec delay between the actual connection establishment
         *     and the internal connection flag update.
         *     This to allow the initial status requests to update the internal
         *     statuses without generating events to Homey.
         *
         * @private
         * @param      {buffer}  data    The data received from the AVR.
         */
    }, {
        key: "_processData",
        value: function _processData(data) {
            var xData = String(data).replace("\r", "");

            this._d("Received : " + xData + ".");

            var newStatus = "";
            var oldStatus = "";
            var newI18n = "";
            var oldI18n = "";

            switch (xData.substr(0, 2)) {

                case "PW":
                    // main power
                    newStatus = xData;
                    oldStatus = this.powerStatus;
                    newI18n = "";
                    oldI18n = "";

                    this.powerStatus = newStatus;

                    if (this.hasNetworkConnection == true) {
                        for (var I = 0; I < this.conf.power.length; I++) {
                            if (newStatus === this.conf.power[I].command) {
                                newI18n = this.conf.power[I].i18n;
                            }
                        }

                        for (var I = 0; I < this.conf.power.length; I++) {
                            if (oldStatus === this.conf.power[I].command) {
                                oldI18n = this.conf.power[I].i18n;
                            }
                        }

                        this.conChn.emit("power_status_chg", this.avrNum, this.avrName, newI18n, oldI18n);
                    }

                    break;
                case "ZM":
                    // main zone power
                    this.mainZonePowerStatus = xData;
                    if (this.hasNetworkConnection === true) {
                        for (var I = 0; I < this.conf.main_zone_power.length; I++) {
                            if (xData === this.conf.main_zone_power[I].command) {
                                this.conChn.emit("power_status_chg", this.avrNum, this.avrName, this.conf.main_zone_power[I].i18n);
                            }
                        }
                    }
                    break;
                case "SI":
                    // inputselection
                    this.inputSourceSelection = xData;
                    if (this.hasNetworkConnection === true) {
                        for (var I = 0; I < this.conf.inputsource.length; I++) {
                            if (xData === this.conf.inputsource[I].command) {
                                this.conChn.emit("isource_status_chg", this.avrNum, this.avrName, this.conf.inputsource[I].i18n);
                            }
                        }
                    }
                    break;
                case "MU":
                    // mute
                    newStatus = xData;
                    oldStatus = this.muteStatus;
                    newI18n = "";
                    oldI18n = "";

                    this.muteStatus = newStatus;

                    if (this.hasNetworkConnection == true) {
                        for (var I = 0; I < this.conf.mute.length; I++) {
                            if (newStatus === this.conf.mute[I].command) {
                                newI18n = this.conf.mute[I].i18n;
                            }
                        }

                        for (var I = 0; I < this.conf.mute.length; I++) {
                            if (oldStatus === this.conf.mute[I].command) {
                                oldI18n = this.conf.mute[I].i18n;
                            }
                        }

                        this.conChn.emit("mute_status_chg", this.avrNum, this.avrName, newI18n, oldI18n);
                    }

                    break;
                case "MS":
                    // Surround mode
                    this.surroundMode = xData;
                    if (this.hasNetworkConnection === true) {
                        for (var I = 0; I < this.conf.surround.length; I++) {
                            if (xData === this.conf.surround[I].command) {
                                this.conChn.emit("mute_status_chg", this.avrNum, this.avrName, this.conf.surround[I].i18n);
                            }
                        }
                    }

                    break;
                case "MV":
                    this._processVolumeData(xData);
                    break;
                case "EC":
                    //Eco setting.
                    newStatus = xData;
                    oldStatus = this.ecoStatus;
                    newI18n = "";
                    oldI18n = "";

                    this.ecoStatus = newStatus;

                    if (this.hasNetworkConnection == true) {
                        for (var I = 0; I < this.conf.eco.length; I++) {
                            if (newStatus === this.conf.eco[I].command) {
                                newI18n = this.conf.eco[I].i18n;
                            }
                        }

                        for (var I = 0; I < this.conf.eco.length; I++) {
                            if (oldStatus === this.conf.eco[I].command) {
                                oldI18n = this.conf.eco[I].i18n;
                            }
                        }

                        this.conChn.emit("eco_status_chg", this.avrNum, this.avrName, newI18n, oldI18n);
                    }

                    break;
            }
        }
    }, {
        key: "_processVolumeData",
        value: function _processVolumeData(xData) {

            this._d("_processVolumeData received '" + xData + "'.");

            if (xData.match(/^MVMAX .*/) === null) {
                this._d("Setting volume status to '" + xData + "'.");
                this.volumeStatus = xData;

                var re = /^MV(\d+)/i;

                var Ar = xData.match(re);

                if (Ar !== null) {
                    this.conChn.emit("volume_chg", this.avrNum, this.avrName, Ar[1]);
                }
            }
        }

        /**
         * Called once after the AVR is created/started to get the current status of:
         *     1) power
         *     2) main zone power
         *     3) mute
         *     4) input selection
         *     5) volume
         *     6) surround
         *     7) eco
         *
         * @private
         */
    }, {
        key: "_getAVRStatusUpdate",
        value: function _getAVRStatusUpdate() {
            this._getAVRPowerStatus();
            this._getAVRMainZonePowerStatus();
            this._getAVRMuteStatus();
            this._getAVRInputSelection();
            this._getAVRVolumeStatus();
            this._getAVRSurroundMode();
            this._getAVREcoStatus();
        }

        /*********************************************************************
         * Debug methods not be to be used in prod env.
         *********************************************************************/

        /**
         * Enables the debug message to console.log (debuggging only).
         */
    }, {
        key: "setConsoleToDebug",
        value: function setConsoleToDebug() {
            this.consoleOut = 1;
            this._d("Avr debug on");
        }

        /**
         * Disables the info/debug message to console.log (debuggging only).
         */
    }, {
        key: "setConsoleOff",
        value: function setConsoleOff() {
            this._d("Avr debug off");
            this.consoleOut = 0;
        }

        /**
         * Overrides the AVR type filtering of some commands (testing only).
         */
    }, {
        key: "setTest",
        value: function setTest() {
            this.test = 1;
        }

        /**
         * Clear the override of AVR type filtering of seom commands (testing only).
         */
    }, {
        key: "clearTest",
        value: function clearTest() {
            this.test = 0;
        }

        /**
         * Send conditionally debug message to console.log (debuggging only).
         *
         * @private
         * @param      {string}  str     The message to console.log
         */
    }, {
        key: "_d",
        value: function _d(str) {
            if (this.consoleOut > 0) {
                this.conChn.emit("debug_log", this.avrNum, this.avrName, str);

                // let date = new Date();
                // let dateStr = date.toISOString();
                //console.log(`${dateStr}-${str}.`);
            }
        }

        /*********************************************************************
         * get AVR initial parameters methods
         *********************************************************************/
        /**
         * Returns the ipaddress of the AVR.
         *
         * @return     {string}  The hostname / IP address
         */
    }, {
        key: "getHostname",
        value: function getHostname() {
            return this.avrHost;
        }

        /**
         * Returns the network port of the AVR
         *
         * @return     {number}  The port.
         */
    }, {
        key: "getPort",
        value: function getPort() {
            return this.avrPort;
        }

        /**
         * Returns the type of the AVR.
         *
         * @return     {string}  The type of the AVR.
         */
    }, {
        key: "getType",
        value: function getType() {
            return this.avrType;
        }

        /**
         * Returns the given name of the AVR as shown in 'Homey'.
         *
         * @return     {string}  The name.
         */
    }, {
        key: "getName",
        value: function getName() {
            return this.avrName;
        }

        /**
         * Determines if configuration loaded.
         *
         * @return     {boolean}  True if configuration loaded, False otherwise.
         */
    }, {
        key: "isConfigLoaded",
        value: function isConfigLoaded() {
            return this.hasConfigloaded;
        }

        /*********************************************************************
         * public non AVR methods
         *********************************************************************/
        /**
         * Disconnects the network connects on request of "Homey" when it
         * shuts down of reboots.
         * Don't start a new connection after receiving the disconnect command.
         */
    }, {
        key: "disconnect",
        value: function disconnect() {

            this._d("Disconnecting on request.");

            this.server.emit("req_disconnect");
        }

        /*********************************************************************
         * Power methods
         *********************************************************************/

        /**
         * Finds the command of the requested power action and send it to the AVR.
         *
         * @param      {string}  cmd     The 'prog_id' string of the requested command.
         * @private
         */
    }, {
        key: "_powerCommand",
        value: function _powerCommand(cmd) {
            for (var I = 0; I < this.conf.power.length; I++) {
                // If 'test' is set don't filter if the command is valid or not for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.power[I].prog_id === cmd) {
                        this._insertIntoSendBuffer(this.conf.power[I].command);
                    }
                } else {
                    if (this.conf.power[I].prog_id === cmd && this.conf.power[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.power[I].command);
                    }
                }
            }
        }

        /**
         * Switch on the main power of the AVR.
         */
    }, {
        key: "powerOn",
        value: function powerOn() {
            this._powerCommand("power_on");
        }

        /**
         * Switch off the main power of the AVR (standby)
         */
    }, {
        key: "powerOff",
        value: function powerOff() {
            this._powerCommand("power_off");
        }

        /**
         * Gets the avr power status.
         * @private
         */
    }, {
        key: "_getAVRPowerStatus",
        value: function _getAVRPowerStatus() {
            this._powerCommand("power_request");
        }

        /**
         * Returns the i18n ident string of the current power status of the AVR.
         * The string should be used to get the i18n string from locales/<lang>.json
         * Current stored power status is used.
         *
         * @return     {string}  The i18n ident string as defined in the conf/<type>.json file.
         */
    }, {
        key: "getPowerStatus",
        value: function getPowerStatus() {

            var retStr = "error.cmdnf";

            for (var I = 0; I < this.conf.power.length; I++) {

                if (this.powerStatus === this.conf.power[I].command) {
                    retStr = this.conf.power[I].text;
                    break;
                }
            }

            return retStr;
        }

        /**
         * Returns true (on) of false (off) based on the current stored power status.
         *
         * @return     {boolean}  The power on / off state.
         */
    }, {
        key: "getPowerOnOffState",
        value: function getPowerOnOffState() {

            for (var I = 0; I < this.conf.power.length; I++) {
                if (this.conf.power[I].prog_id === "power_on") {
                    if (this.conf.power[I].command === this.powerStatus) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        }

        /*********************************************************************
         * Main zone power methods
         *********************************************************************/

        /**
         * Finds the command of the requested main zone power action and send it to the AVR.
         *
         * @param      {string}  cmd     The 'prog_id' string of the requested command.
         * @private
         */
    }, {
        key: "_mainZonePowerCommand",
        value: function _mainZonePowerCommand(cmd) {
            for (var I = 0; I < this.conf.main_zone_power.length; I++) {
                // If 'test' is set don't filter if the command is valid for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.main_zone_power[I].prog_id === cmd) {
                        this._insertIntoSendBuffer(this.conf.main_zone_power[I].command);
                    }
                } else {
                    if (this.conf.main_zone_power[I].prog_id === cmd && this.conf.main_zone_power[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.main_zone_power[I].command);
                    }
                }
            }
        }

        /**
         * Switch on the main zone power of the AVR
         */
    }, {
        key: "mainZonePowerOn",
        value: function mainZonePowerOn() {
            this._mainZonePowerCommand("mzpower_on");
        }

        /**
         * Switch of the main zone power of the AVR
         */
    }, {
        key: "mainZonePowerOff",
        value: function mainZonePowerOff() {
            this._mainZonePowerCommand("mzpower_off");
        }

        /**
         * Gets the avr main zone power status.
         * @private
         */
    }, {
        key: "_getAVRMainZonePowerStatus",
        value: function _getAVRMainZonePowerStatus() {
            this._mainZonePowerCommand("mzpower_request");
        }

        /**
         * Returns the i18n ident string of the current main zone power status of the AVR.
         * The string should be used to get the i18n string from locales/<lang>.json
         * Current stored main zone power status is used.
         *
         * @return     {string}  The i18n ident string as defined in the conf/<type>.json file.
         */
    }, {
        key: "getMainZonePowerStatus",
        value: function getMainZonePowerStatus() {

            var retStr = "error.cmdnf";

            for (var I = 0; I < this.conf.main_zone_power.length; I++) {
                if (this.mainZonePowerStatus === this.conf.main_zone_power[I].command) {
                    retStr = this.conf.main_zone_power[I].text;
                    break;
                }
            }

            return retStr;
        }

        /**
         * Returns true of false based on the current stored main zone power status.
         *
         * @return     {boolean}  The main zone power on off state.
         */
    }, {
        key: "getMainZonePowerOnOffState",
        value: function getMainZonePowerOnOffState() {

            for (var I = 0; I < this.conf.main_zone_power.length; I++) {
                if (this.conf.main_zone_power[I].prog_id === "mzpower_on") {
                    if (this.conf.main_zone_power[I].command === this.powerMainZoneStatus) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        }

        /*********************************************************************
         * Mute methods
         *********************************************************************/

        /**
        * Finds the command of the requested mute action and send it to the AVR.
        *
        * @param      {string}  cmd     The 'prog_id' string of the requested command.
        * @private
        */
    }, {
        key: "_MuteCommand",
        value: function _MuteCommand(cmd) {
            for (var I = 0; I < this.conf.mute.length; I++) {
                // If 'test' is set don't filter if the command is valid for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.mute[I].prog_id === cmd) {
                        this._insertIntoSendBuffer(this.conf.mute[I].command);
                    }
                } else {
                    if (this.conf.mute[I].prog_id === cmd && this.conf.mute[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.mute[I].command);
                    }
                }
            }
        }

        /**
         * Switch mute on
         */
    }, {
        key: "muteOn",
        value: function muteOn() {
            this._MuteCommand("mute_on");
        }

        /**
         * Switch mute off
         */
    }, {
        key: "muteOff",
        value: function muteOff() {
            this._MuteCommand("mute_off");
        }

        /**
         * Gets the avr mute status.
         * @private
         */
    }, {
        key: "_getAVRMuteStatus",
        value: function _getAVRMuteStatus() {
            this._MuteCommand("mute_request");
        }

        /**
         * Returns the i18n ident string of the current mute status of the AVR.
         * The string should be used to get the i18n string from locales/<lang>.json
         * Current stored mute status is used.
         *
         * @return     {string}  The i18n ident string as defined in the conf/<type>.json file.
         */
    }, {
        key: "getMuteStatus",
        value: function getMuteStatus() {

            var retStr = "error.cmdnf";

            for (var I = 0; I < this.conf.mute.length; I++) {

                if (this.muteStatus === this.conf.mute[I].command) {
                    retStr = this.conf.mute[I].text;
                    break;
                }
            }

            return retStr;
        }

        /**
         * Returns true of false based on the current stored mute status.
         *
         * @return     {boolean}  The mute on off state.
         */
    }, {
        key: "getMuteOnOffState",
        value: function getMuteOnOffState() {

            for (var I = 0; I < this.conf.mute.length; I++) {
                if (this.conf.mute[I].prog_id === "mute_on") {
                    if (this.conf.mute[I].command === this.muteStatus) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        }

        /*********************************************************************
         * Inputsource selection methods
         *********************************************************************/

        /**
         * Finds the command of the requested input source and send it to the AVR.
         *
         * @param      {string}  cmd     The 'prog_id' string of the requested command.
         * @private
         */
    }, {
        key: "_selectInputSource",
        value: function _selectInputSource(source) {

            for (var I = 0; I < this.conf.inputsource.length; I++) {
                // If 'test' is set don't filter if the command is valid for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.inputsource[I].prog_id === source) {

                        this._insertIntoSendBuffer(this.conf.inputsource[I].command);
                    }
                } else {
                    if (this.conf.inputsource[I].prog_id === source && this.conf.inputsource[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.inputsource[I].command);
                    }
                }
            }
        }

        /**
         * Returns the input source selection array with type supported sources.
         *
         * @return     {array}  The valid input selection array.
         */
    }, {
        key: "getValidInputSelection",
        value: function getValidInputSelection() {

            return this.selAr;
        }

        /**
         * Fill the command into the send buffer and start the send loop.
         *
         * @param      {string}  command_id  The command id string
         */
    }, {
        key: "sendInputSourceCommand",
        value: function sendInputSourceCommand(command_id) {
            this._insertIntoSendBuffer(command_id);
        }

        /**
         * Select Phono as input source
         */
    }, {
        key: "selectInputSourcePhono",
        value: function selectInputSourcePhono() {
            this._selectInputSource("i_phono");
        }

        /**
         * Select CD as input source
         */
    }, {
        key: "selectInputSourceCd",
        value: function selectInputSourceCd() {
            this._selectInputSource("i_cd");
        }

        /**
         * Select DVD as input source
         */
    }, {
        key: "selectInputSourceDvd",
        value: function selectInputSourceDvd() {
            this._selectInputSource("i_dvd");
        }

        /**
         * Select Bluray (bd) as input source
         */
    }, {
        key: "selectInputSourceBluray",
        value: function selectInputSourceBluray() {
            this._selectInputSource("i_bd");
        }

        /**
         * Select TV as input source
         */
    }, {
        key: "selectInputSourceTv",
        value: function selectInputSourceTv() {
            this._selectInputSource("i_tv");
        }

        /**
         * Select SAT/CBL as input source
         */
    }, {
        key: "selectInputSourceSatCbl",
        value: function selectInputSourceSatCbl() {
            this._selectInputSource("i_sat_cbl");
        }

        /**
         * Select SAT as input source
         */
    }, {
        key: "selectInputSourceSat",
        value: function selectInputSourceSat() {
            this._selectInputSource("i_sat");
        }

        /**
         * Select mplay as input source
         */
    }, {
        key: "selectInputSourceMplay",
        value: function selectInputSourceMplay() {
            this._selectInputSource("i_mplay");
        }

        /**
         * Select VCR as input source
         */
    }, {
        key: "selectInputSourceVcr",
        value: function selectInputSourceVcr() {
            this._selectInputSource("i_vcr");
        }

        /**
         * Select game as input source
         */
    }, {
        key: "selectInputSourceGame",
        value: function selectInputSourceGame() {
            this._selectInputSource("i_game");
        }

        /**
         * Select V.AUX as input source
         */
    }, {
        key: "selectInputSourceVaux",
        value: function selectInputSourceVaux() {
            this._selectInputSource("i_vaux");
        }

        /**
         * Select Tuner as input source
         */
    }, {
        key: "selectInputSourceTuner",
        value: function selectInputSourceTuner() {
            this._selectInputSource("i_tuner");
        }

        /**
         * Select spotify as input source
         */
    }, {
        key: "selectInputSourceSpotify",
        value: function selectInputSourceSpotify() {
            this._selectInputSource("i_spotify");
        }

        /**
         * Select napster as input source
         */
    }, {
        key: "selectInputSourceNapster",
        value: function selectInputSourceNapster() {
            this._selectInputSource("i_napster");
        }

        /**
         * Select flickr as input source
         */
    }, {
        key: "selectInputSourceFlickr",
        value: function selectInputSourceFlickr() {
            this._selectInputSource("i_flickr");
        }

        /**
         * Select iradio as input source
         */
    }, {
        key: "selectInputSourceIradio",
        value: function selectInputSourceIradio() {
            this._selectInputSource("i_iradio");
        }

        /**
         * Select favorites as input source
         */
    }, {
        key: "selectInputSourceFavorites",
        value: function selectInputSourceFavorites() {
            this._selectInputSource("i_favorites");
        }

        /**
         * Select AUX1 as input source
         */
    }, {
        key: "selectInputSourceAux1",
        value: function selectInputSourceAux1() {
            this._selectInputSource("i_aux1");
        }

        /**
         * Select AUX2 as input source
         */
    }, {
        key: "selectInputSourceAux2",
        value: function selectInputSourceAux2() {
            this._selectInputSource("i_aux2");
        }

        /**
         * Select AUX3 as input source
         */
    }, {
        key: "selectInputSourceAux3",
        value: function selectInputSourceAux3() {
            this._selectInputSource("i_aux3");
        }

        /**
         * Select AUX4 as input source
         */
    }, {
        key: "selectInputSourceAux4",
        value: function selectInputSourceAux4() {
            this._selectInputSource("i_aux4");
        }

        /**
         * Select AUX5 as input source
         */
    }, {
        key: "selectInputSourceAux5",
        value: function selectInputSourceAux5() {
            this._selectInputSource("i_aux5");
        }

        /**
         * Select AUX6 as input source
         */
    }, {
        key: "selectInputSourceAux6",
        value: function selectInputSourceAux6() {
            this._selectInputSource("i_aux6");
        }

        /**
         * Select AUX7 as input source
         */
    }, {
        key: "selectInputSourceAux7",
        value: function selectInputSourceAux7() {
            this._selectInputSource("i_aux7");
        }

        /**
         * Select net/usb as input source
         */
    }, {
        key: "selectInputSourceInetUsb",
        value: function selectInputSourceInetUsb() {
            this._selectInputSource("i_net_usb");
        }

        /**
         * Select net as input source
         */
    }, {
        key: "selectInputSourceNet",
        value: function selectInputSourceNet() {
            this._selectInputSource("i_net");
        }

        /**
         * Select bluetooth (bt) as input source
         */
    }, {
        key: "selectInputSourceBluetooth",
        value: function selectInputSourceBluetooth() {
            this._selectInputSource("i_bt");
        }

        /**
         * Select mxport as input source
         */
    }, {
        key: "selectInputSourceMxport",
        value: function selectInputSourceMxport() {
            this._selectInputSource("i_mxport");
        }

        /**
         * Select usb-ipod as input source
         */
    }, {
        key: "selectInputSourceUsbIpod",
        value: function selectInputSourceUsbIpod() {
            this._selectInputSource("i_usb_ipod");
        }

        /**
         * Gets the avr input selection.
         * @private
         */
    }, {
        key: "_getAVRInputSelection",
        value: function _getAVRInputSelection() {
            this._selectInputSource("i_request");
        }

        /**
         * Returns the i18n ident string of the current inputsource of the AVR.
         * The string should be used to get the i18n string from locales/<lang>.json
         * Current stored mute status is used.
         *
         * @return     {string}  The i18n ident string as defined in the conf/<type>.json file.
         */
    }, {
        key: "getInputSelection",
        value: function getInputSelection() {

            var retStr = "error.cmdnf";

            for (var I = 0; I < this.conf.inputsource.length; I++) {

                if (this.inputSourceSelection === this.conf.inputsource[I].command) {
                    retStr = this.conf.inputsource[I].i18n;
                    break;
                }
            }

            return retStr;
        }

        /*********************************************************************
         * Volume methods
         *********************************************************************/

        /**
         * Finds the command of the requested volume action and fills the send buffer
         *
         * @param      {string}  cmd     The command
         * @param      {string}  level   The level to set the volume.
         * @private
         */
    }, {
        key: "_volumeCommand",
        value: function _volumeCommand(cmd, level) {
            for (var I = 0; I < this.conf.volume.length; I++) {
                // If 'test' is set don't filter if the command is valid for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.volume[I].prog_id === cmd) {
                        this._insertIntoSendBuffer(this.conf.volume[I].command + ("" + level));
                    }
                } else {
                    if (this.conf.volume[I].prog_id === cmd && this.conf.volume[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.volume[I].command + ("" + level));
                    }
                }
            }
        }

        /**
         * Increase the volume
         */
    }, {
        key: "volumeUp",
        value: function volumeUp() {
            this._volumeCommand("volume_up", "");
        }

        /**
         * Decrease the volume
         */
    }, {
        key: "volumeDown",
        value: function volumeDown() {
            this._volumeCommand("volume_down", "");
        }

        /**
         * Sets the volume level.
         *
         * @param      {number}  level   The requested volume level
         */
    }, {
        key: "setVolume",
        value: function setVolume(level) {
            if (level >= 0 && level < 80) {
                this._volumeCommand("volume_set", level);
            }
        }

        /**
         * Gets the avr volume status.
         */
    }, {
        key: "_getAVRVolumeStatus",
        value: function _getAVRVolumeStatus() {
            this._volumeCommand("volume_request", "");
        }

        /**
         * Returns the current volume level if known otherwise "unknown".
         *
         * @return     {string}  The volume level.
         */
    }, {
        key: "getVolume",
        value: function getVolume() {
            this._d("volume is " + this.volumeStatus + ".");

            var re = /^MV(\d+)/i;

            var Ar = this.volumeStatus.match(re);

            if (Ar !== null) {
                return Ar[1];
            } else {
                return "unknown";
            }
        }

        /*********************************************************************
         * surround methods
         *********************************************************************/

        /**
         * Finds the command of the requested surround action and fills the send buffer.
         *
         * @param      {string}  cmd     The 'prog_id' string of the requested command.
         * @private
         */
    }, {
        key: "_setSurroundMode",
        value: function _setSurroundMode(cmd) {
            for (var I = 0; I < this.conf.surround.length; I++) {
                // If 'test' is set don't filter if the command is valid for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.surround[I].prog_id === cmd) {
                        this._insertIntoSendBuffer(this.conf.surround[I].command);
                    }
                } else {
                    if (this.conf.surround[I].prog_id === cmd && this.conf.surround[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.surround[I].command);
                    }
                }
            }
        }

        /**
         * Returns the surround array with the AVR type support surround modes.
         *
         * @return     {array}  The surround supported mode array.
         */
    }, {
        key: "getValidSurround",
        value: function getValidSurround() {

            return this.surroundAr;
        }

        /**
         * Send the surrounf command to the send bugger and start the even loop.
         *
         * @param      {string}  command  The command
         */
    }, {
        key: "sendSurroundCommand",
        value: function sendSurroundCommand(command) {
            this._insertIntoSendBuffer(command);
        }

        /**
         * Sets the surround mode to movies.
         */
    }, {
        key: "setSurroundModeToMovies",
        value: function setSurroundModeToMovies() {
            this._setSurroundMode("s_movie");
        }

        /**
         * Sets the surround mode to music.
         */
    }, {
        key: "setSurroundModeToMusic",
        value: function setSurroundModeToMusic() {
            this._setSurroundMode("s_music");
        }

        /**
         * Sets the surround mode to game.
         */
    }, {
        key: "setSurroundModeToGame",
        value: function setSurroundModeToGame() {
            this._setSurroundMode("s_game");
        }

        /**
         * Sets the surround mode to direct.
         */
    }, {
        key: "setSurroundModeToDirect",
        value: function setSurroundModeToDirect() {
            this._setSurroundMode("s_direct");
        }

        /**
         * Sets the surround mode to pure direct.
         */
    }, {
        key: "setSurroundModeToPureDirect",
        value: function setSurroundModeToPureDirect() {
            this._setSurroundMode("s_pure");
        }

        /**
         * Sets the surround mode to stereo.
         */
    }, {
        key: "setSurroundModeToStereo",
        value: function setSurroundModeToStereo() {
            this._setSurroundMode("s_stereo");
        }

        /**
         * Sets the surround mode to automatic.
         */
    }, {
        key: "setSurroundModeToAuto",
        value: function setSurroundModeToAuto() {
            this._setSurroundMode("s_auto");
        }

        /**
         * Sets the surround mode to neural.
         */
    }, {
        key: "setSurroundModeToNeural",
        value: function setSurroundModeToNeural() {
            this._setSurroundMode("s_neural");
        }

        /**
         * Sets the surround mode to standard.
         */
    }, {
        key: "setSurroundModeToStandard",
        value: function setSurroundModeToStandard() {
            this._setSurroundMode("s_standard");
        }

        /**
         * Sets the surround mode to dolby.
         */
    }, {
        key: "setSurroundModeToDolby",
        value: function setSurroundModeToDolby() {
            this._setSurroundMode("s_dolby");
        }

        /**
         * Sets the surround mode to dts.
         */
    }, {
        key: "setSurroundModeToDts",
        value: function setSurroundModeToDts() {
            this._setSurroundMode("s_dts");
        }

        /**
         * Sets the surround mode to multi chn stereo.
         */
    }, {
        key: "setSurroundModeToMultiChnStereo",
        value: function setSurroundModeToMultiChnStereo() {
            this._setSurroundMode("s_mchstereo");
        }

        /**
         * Sets the surround mode to matrix.
         */
    }, {
        key: "setSurroundModeToMatrix",
        value: function setSurroundModeToMatrix() {
            this._setSurroundMode("s_matrix");
        }

        /**
         * Sets the surround mode to virtual.
         */
    }, {
        key: "setSurroundModeToVirtual",
        value: function setSurroundModeToVirtual() {
            this._setSurroundMode("s_virtual");
        }

        /**
         * Sets the surround mode to left.
         */
    }, {
        key: "setSurroundModeToLeft",
        value: function setSurroundModeToLeft() {
            this._setSurroundMode("s_left");
        }

        /**
         * Sets the surround mode to right.
         */
    }, {
        key: "setSurroundModeToRight",
        value: function setSurroundModeToRight() {
            this._setSurroundMode("s_right");
        }

        /**
         * Gets the avr surround mode.
         * @private
         */
    }, {
        key: "_getAVRSurroundMode",
        value: function _getAVRSurroundMode() {
            this._setSurroundMode("s_request");
        }

        /**
         * Returns the i18n ident string of the current surround mode of the AVR.
         * The string should be used to get the i18n string from locales/<lang>.json
         * Current stored mute status is used.
         *
         * @return     {string}  The i18n ident string as defined in the conf/<type>.json file.
         */
    }, {
        key: "getSurroundMode",
        value: function getSurroundMode() {

            var retStr = "error.cmdnf";

            for (var I = 0; I < this.conf.surround.length; I++) {

                if (this.surroundMode === this.conf.surround[I].command) {
                    retStr = this.conf.surround[I].i18n;
                    break;
                }
            }

            return retStr;
        }

        /*********************************************************************
         * ECO methods
         *********************************************************************/

        /**
         * Finds the command of the requested eco action and fills the send buffer.
         *
         * @param      {string}  cmd     The 'prog_id' string of the requested command.
         * @private
         */
    }, {
        key: "_ecoMode",
        value: function _ecoMode(cmd) {
            for (var I = 0; I < this.conf.eco.length; I++) {
                // If 'test' is set don't filter if the command is valid for
                // this type of AVR.
                if (this.test === 1) {
                    if (this.conf.eco[I].prog_id === cmd) {
                        this._insertIntoSendBuffer(this.conf.eco[I].command);
                    }
                } else {
                    if (this.conf.eco[I].prog_id === cmd && this.conf.eco[I].valid === true) {

                        this._insertIntoSendBuffer(this.conf.eco[I].command);
                    }
                }
            }
        }

        /**
         * Gets the supported eco commands for this type of AVR.
         *
         * @return     {Array}  The array with valid eco commands.
         */
    }, {
        key: "getValidEcoCommands",
        value: function getValidEcoCommands() {
            return this.ecoAr;
        }

        /**
         * Fill the command into the send buffer and start the send loop.
         *
         * @param      {string}  command  The eco command string
         */
    }, {
        key: "sendEcoCommand",
        value: function sendEcoCommand(command) {
            if (command !== "ECO_UN_SUPPORTED") {
                this._insertIntoSendBuffer(command);
            } else {
                this._d("Eco is unsupported for the device.");
            }
        }

        /**
         * Check if the AVR support the 'eco' commands.
         *
         * @return     {boolean}  True if has eco, False otherwise.
         */
    }, {
        key: "hasEco",
        value: function hasEco() {
            if (this.conf.eco[0].valid === true) {
                return true;
            } else {
                return false;
            }
        }

        /**
         * Switch eco mode on
         */
    }, {
        key: "ecoOn",
        value: function ecoOn() {
            this._ecoMode("eco_on");
        }

        /**
         * Switch eco mode off
         */
    }, {
        key: "ecoOff",
        value: function ecoOff() {
            this._ecoMode("eco_off");
        }

        /**
         * Switch eco mode to auto
         */
    }, {
        key: "ecoAuto",
        value: function ecoAuto() {
            this._ecoMode("eco_auto");
        }

        /**
         * Gets the avr eco status.
         * @private
         */
    }, {
        key: "_getAVREcoStatus",
        value: function _getAVREcoStatus() {
            this._ecoMode("eco_request");
        }

        /**
         * Returns the i18n ident string of the current eco mode of the AVR.
         * The string should be used to get the i18n string from locales/<lang>.json
         * Current stored mute status is used.
         *
         * @return     {string}  The i18n ident string as defined in the conf/<type>.json file.
         */
    }, {
        key: "getEcoMode",
        value: function getEcoMode() {

            var retStr = "error.cmdnf";

            for (var I = 0; I < this.conf.eco.length; I++) {

                if (this.ecoStatus === this.conf.eco[I].command) {
                    retStr = this.conf.eco[I].i18n;
                    break;
                }
            }

            return retStr;
        }
    }]);

    return Avr;
})();

module.exports = Avr;
