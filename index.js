var request = require("request");
var Toon = require("./toon");
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
  this.toon = new Toon(config.username, config.password, this.log);
  this.lastupdate = null;

	this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

  this.log("Toon Initialized, it may take a few minutes before any data will be visible to HomeKit.");
}

ToonAccessory.prototype = {

  getToonState: function (callback) {
    var thermostatState = this.toon.toonthermostatstate;

    if (thermostatState !== null) {
      this.lastupdate = this.toon.lastupdate;
      callback(null, thermostatState);
    } else {
      this.log("Could not get Toon state. (It may not have been initialized yet.)");
      callback(new Error("Toon Thermostat Data Error."));
    }
  },

  getCurrentHeatingCoolingState: function(callback) {
    var self = this;

    self.getToonState(function(err, state) {
      if (!err) {
        var burnerInfo = state.burnerInfo;
        var heatingcoolingstate = Characteristic.CurrentHeatingCoolingState.OFF;

        if (state.burnerInfo == '1') {
          heatingcoolingstate = Characteristic.CurrentHeatingCoolingState.HEAT;
        } else {
          heatingcoolingstate = Characteristic.CurrentHeatingCoolingState.OFF;
        }

        callback(null, heatingcoolingstate);
      } else {
        callback(err);
      }
    });
  },

  setTargetHeatingCoolingState: function(value, callback) {
    this.log("Setting a Target State is not supported by Toon");
    callback(new Error("Setting a Target State is not supported by Toon"));
  },

  getTargetHeatingCoolingState: function(callback) {
    var self = this;

    self.getToonState(function(err, state) {
      if (!err) {
        var currentTemp = state.currentTemp / 100;
        var targetTemp = state.currentSetpoint / 100;
        var heatingcoolingstate = Characteristic.TargetHeatingCoolingState.OFF;

        if (currentTemp < targetTemp) {
          heatingcoolingstate = Characteristic.TargetHeatingCoolingState.HEAT;
        } else {
          heatingcoolingstate = Characteristic.TargetHeatingCoolingState.COOL;
        }

        callback(null, heatingcoolingstate);
      } else {
        callback(err);
      }
    });
  },

  getCurrentTemperature: function(callback) {
    var self = this;

    self.getToonState(function(err, state) {
      if (!err) {
        var currentTemp = state.currentTemp / 100;
        self.log("Last dataupdate: ", self.lastupdate);
        self.log("Current Temperature: ", currentTemp);
        callback(null, currentTemp);
      } else {
        callback(err);
      }
    });
  },

  getTargetTemperature: function(callback) {
    var self = this;

    self.getToonState(function(err, state) {
      if (!err) {
        var targetTemp = state.currentSetpoint / 100;
        callback(null, targetTemp);
      } else {
        callback(err);
      }
    });
  },  

  setTargetTemperature: function(value, callback) {
    var self = this;

    self.getToonState(function(err, state) {
      if (!err) {
        self.toon.setToonTemperature(value, function(error) {
          if (!error) {
            state.currentSetpoint = value * 100;
            self.log("Temperature Set to: ", value);
            callback();
          } else {
            callback(new Error("Could not set Toon Temperature"));
          }
        });
      } else {
        callback(err);
      }
    });
  },

  getTemperatureDisplayUnits: function(callback) {
    callback(null, this.temperatureDisplayUnits);
  },

  getServices: function() {

    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Eneco")
      .setCharacteristic(Characteristic.Model, "Toon")
      .setCharacteristic(Characteristic.SerialNumber, "");

    var thermostatService = new Service.Thermostat(this.name);

      // Required Characteristics
      thermostatService
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('set', this.setTargetHeatingCoolingState.bind(this))
        .on('get', this.getTargetHeatingCoolingState.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('set', this.setTargetTemperature.bind(this))
        .on('get', this.getTargetTemperature.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this));

      return [informationService, thermostatService];
    }
};