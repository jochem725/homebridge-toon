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
  this.toon = new Toon(config.username, config.password);
  	
	this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
  this.currentTemperature = 0;
  this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
  this.targetTemperature = 0;
  this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;

  this.log("Toon Initialized, it may take a few minutes before any data will be visible to HomeKit.");

  var self = this;
  var thermostatState = null;
  // Update changes  every 5 seconds.
  setInterval(function updateThermostatData() {
    thermostatState = self.toon.toonthermostatstate;
    if (thermostatState !== null) {
      self.currentTemperature = (thermostatState.currentTemp / 100);
      self.targetTemperature = (thermostatState.currentSetpoint / 100);

      // If the Heating is activated, then mark the current state as HEAT.
      if (thermostatState.burnerInfo == '1') {
          self.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
      } else {
          self.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
      }

      // Set the target state, depending if the current temperature and the target temperature.
      if (self.currentTemperature < self.targetTemperature) {
        self.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
      } else {
        self.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
      }
    }    
  }, 5 * 1000);
}

ToonAccessory.prototype = {

  getCurrentHeatingCoolingState: function(callback) {
    this.log("Heating State: ", this.heatingCoolingState);
    callback(null, this.heatingCoolingState);
  },

  setTargetHeatingCoolingState: function(value, callback) {
    this.log("Target Heating State: ", value);
    callback();
  },
  getCurrentTemperature: function(callback) {
    this.log("Current Temperature: ", this.currentTemperature);
    callback(null, this.currentTemperature);
  },
  setTargetTemperature: function(value, callback) {
    var self = this;

    self.toon.setToonTemperature(value, function(error) {
      if (!error) {
        self.targetTemperature = value;
        self.log("Temperature Set to: ", value);
        callback();
      } else {
        callback(new Error("Could not set Toon Temperature"));
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
        .on('get', function (callback) { 
          callback(null, this.targetHeatingCoolingState);
        }.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('set', this.setTargetTemperature.bind(this))
        .on('get', function (callback) {
          callback(null, this.targetTemperature);
        }.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this));

      return [informationService, thermostatService];
    }
};