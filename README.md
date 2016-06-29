# Homeyavr

Application to connect Homey to a Marantz AVR.

Version: 1.0.0

Currently working and supported in flows:

* power commands for AVR and main zone.
	- On
	- Off
* mute commands
	- On
	- Off
* source input selection
	- Select input source selections depending on the AVR type.
* volume
	 - Up
	 - Down
	 - Set (values between 0 - 80 )
* surround mode selection
	- Surround mode selections depending on the AVR type
* ECO depending on the AVR type
	- On
	- Off
	- Auto
* Triggers for:
	- power
	- mute
	- eco

* All selection strings and messages are using the "locales/<LANG>.json" files.
  I.e for new languages support only a new "locales/<LANG>.json" and app.json
  should be suffient.



App updates the internal status of the AVR constantly, even if the command is given
by a different application or by remote control, as long the AVR is transmitting
the commands.

Not working:
* Save settings.
  0.8.39 does not closed the settings window after save-settings and
  the changed values are not saved by Homey.
  Program will change the running parameters but after a restart the old values will be
  supplied by Homey and used.

To do:
* Use capabilities in the web interface as example light.
  Currently there are no capabilities defined (yet??) for the 'other' class.
  Changing the class to 'light' will give the on/off capability in the web interface.


Marantz AVR supported :
av8802, av8801, av7702, av7701, av7005,
sr7010, sr7009, sr7008, sr7007, sr7005,
sr6010, sr6009, sr6008, sr6007, sr6006, sr6005,
sr5010, sr5009, sr5008, sr5006, sr5005,
nr1606, nr1605, nr1604, nr1603, nr1602,
nr1505, nr1504
