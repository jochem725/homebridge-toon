var request = require("request");
var toon = require("./toon");
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerAccessory("homebridge-toon", "Toon", ToonAccessory);
};

function ToonAccessory(log, config) {
    this.log = log;
    this.name = config.name;

    // Index selecting the agreement, if a user has multiple agreements (due to moving, etc.).
    var agreementIndex = 0;

    if (config.agreementIndex !== undefined) {
        agreementIndex = config.agreementIndex;
    }

    this.toon = toon(config.username, config.password, agreementIndex, this.log);

    var self = this;

    self.toon.emitter.on('thermostatUpdate', function(thermostatInfo) {
        self.updateState(self, thermostatInfo)
    });

    self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

    self.log("Toon Initialized, it may take a few minutes before any data will be visible to HomeKit.");
}

ToonAccessory.prototype = {
    updateState: function (accessory, thermostatInfo) {
        var self = accessory;

        self.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).setValue(thermostatInfo.currentTemp / 100, undefined, 'event');
        self.thermostatService.getCharacteristic(Characteristic.TargetTemperature).setValue(thermostatInfo.currentSetpoint / 100, undefined, 'event');

        var heatingCoolingState;
        if (thermostatInfo.burnerInfo === '1') {
            heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
        } else {
            heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
        }

        self.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(heatingCoolingState, undefined, 'event');
    },

    getToonState: function () {
        var self = this;
        var thermostatInfo = self.toon.getThermostatInfo();

        return self.toon.getThermostatInfo()
            .then(function () {
                if (thermostatInfo !== {}) {
                    return thermostatInfo;
                } else {
                    throw new Error("Could not get Toon state. (It may not have been initialized yet.)");
                }
            })
    },

    getToonClientDataProperty: function (property) {
        var self = this;
        var clientData = self.toon.getClientData();

        if (clientData.hasOwnProperty(property) === true) {
            return clientData[property];
        } else {
            return '';
        }
    },

    getCurrentHeatingCoolingState: function (callback) {
        var self = this;

        self.getToonState()
            .then(function (thermostatInfo) {
                var burnerInfo = thermostatInfo.burnerInfo;

                // Toon can only activate the heating, so return heat or off.
                var heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;

                if (burnerInfo === '1') {
                    heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
                }

                callback(null, heatingCoolingState);
            })
            .catch(function (err) {
                self.log("Error getting HeatingCoolingState: ", err);
                callback(err);
            });
    },

    setTargetHeatingCoolingState: function (value, callback) {
        var self = this;

        // Setting a target is not supported, so it will always become equal to the current target heating cooling state.
        self.getTargetHeatingCoolingState(function (err, heatingCoolingState) {
            if (!err) {
                callback(null, heatingCoolingState);
            } else {
                callback(err);
            }
        });
    },

    getTargetHeatingCoolingState: function (callback) {
        callback(null, Characteristic.TargetHeatingCoolingState.AUTO);
    },

    getCurrentTemperature: function (callback) {
        var self = this;

        self.getToonState()
            .then(function (thermostatInfo) {
                var currentTemp = thermostatInfo.currentTemp / 100;
                self.log("Current Temperature: ", currentTemp);
                callback(null, currentTemp);
            })
            .catch(function (err) {
                self.log("Error getting CurrentTemperature: ", err);
                callback(err);
            });
    },

    getTargetTemperature: function (callback) {
        var self = this;

        self.getToonState()
            .then(function (thermostatInfo) {
                var targetTemp = thermostatInfo.currentSetpoint / 100;
                callback(null, targetTemp);
            })
            .catch(function (err) {
                self.log("Error getting TargetTemperature: ", err);
                callback(err);
            });
    },

    setTargetTemperature: function (value, callback, context) {
        var self = this;

        if (context !== 'event') {
            self.toon.setTemperature(value)
                .then(function () {
                    callback();
                })
                .catch(function (err) {
                    self.log("Error setting TargetTemperature: ", err);
                    callback(err);
                });
        } else {
            callback(null);
        }
    },

    getTemperatureDisplayUnits: function (callback) {
        callback(null, this.temperatureDisplayUnits);
    },

    getServices: function () {
        var self = this;
        self.informationService = new Service.AccessoryInformation();

        self.informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Eneco Toon')
            .setCharacteristic(Characteristic.Model, "Toon")
            .setCharacteristic(Characteristic.SerialNumber, this.getToonClientDataProperty('displayHardwareVersion'));

        self.thermostatService = new Service.Thermostat(this.name);

        // Required Characteristics
        self.thermostatService
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this));

        self.thermostatService
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('set', this.setTargetHeatingCoolingState.bind(this))
            .on('get', this.getTargetHeatingCoolingState.bind(this));

        self.thermostatService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));

        self.thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .on('set', this.setTargetTemperature.bind(this))
            .on('get', this.getTargetTemperature.bind(this));

        self.thermostatService
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this));

        return [self.informationService, self.thermostatService];
    }
};