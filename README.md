# HomeyAvr

Application to allow Homey to control a Marantz AVR.

## Supported selections:
### Power , Main Zone Power and Mute
Commands: On, Off<br />
Triggers: On, Off<br />
### Eco
Commands: on, off , auto<br />
Triggers: on, off, auto<br />
(only if the Marantz AVR supports the ECO modes.)
### Volume
Commands: volume up, volume down, set volume<br />
### InputSource:
Commands: select an input source.<br />
Triggers: available are a 'select' trigger on the new inputsource and a 'leave' trigger on the old inputsource.
### Surround mode:
Commands: select a surround mode.<br />
Trigger: available are a 'select' trigger on the new mode and a 'leave' trigger of the old mode.
Note: only the supported surround modes of the chosen AVR are available.

## Supported Marantz AVRs:</br />
av8802, av8801, av7702, av7701, av7005,
sr7010, sr7009, sr7008, sr7007, sr7005,
sr6010, sr6009, sr6008, sr6007, sr6006, sr6005,
sr5010, sr5009, sr5008, sr5006, sr5005,
nr1606, nr1605, nr1604, nr1603, nr1602,
nr1505, nr1504

## Functionality:
* The Homey AVR device will be available as long there is a network connection with the AVR. Unavailable means there is no network connection.
* Application updates the internal status of the AVR constantly, even if the commands is given by a different application or by remote control as long there is a network connection.
* All selection strings and messages are using the "locale/&lt;LANG&gt;.json" files.

<strong>Note</strong>:
<em>This is a generated homey application.
Don't edit the files directly but edit the source files and re-generate.</em><br />
Source: https://github.com/evgilst/genhomeyavr  

---
