import { ToonConnection, ThermostatInfo } from "./Toon/ToonConnection";
import ToonConfig from "./config";

var Accessory: any, Service: any, Characteristic: any, UUIDGen: any;

const plugin = "homebridge-toon";
const platform = "Toon";

export = function (homebridge: any) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform(plugin, platform, ToonPlatform, true);
}

class ToonPlatform {
    agreementIndex: number;
    connection: ToonConnection;
    accessory?: ToonAccessory;

    constructor(private log: (format: string, message?: any) => void, private config: ToonConfig, private api: any) {
        this.config;
        this.api.on('didFinishLaunching', this.didFinishLaunching);
    }

    didFinishLaunching = () => {
        this.log("Toon Initialized, it may take a few minutes before any data will be visible to HomeKit.");
        this.addAccessory()
    }

    
    configureAccessory(accessory: any) {
        accessory.reachable = true;

        this.accessory = new ToonAccessory(accessory, this.config, this.log);          
    }

    addAccessory() {
        if (this.accessory !== undefined) {
            return
        }

        const accessory = new Accessory("Toon Thermostaat", UUIDGen.generate("Toon Thermostaat"));        
        this.accessory = new ToonAccessory(accessory, this.config, this.log);

        this.api.registerPlatformAccessories(plugin, platform, [accessory]);
    }

    removeAccessory(device: any) {
        this.api.unregisterPlatformAccessories(plugin, platform, [device]);
        this.accessory = undefined;
    }

};

class ToonAccessory {
    
        private deviceId: string;
        private connection: ToonConnection;
    
        constructor(private accessory: any, private config: ToonConfig, private log: any) {
            this.deviceId = this.accessory.context.deviceId;
            this.connection = new ToonConnection(this.config, this.log, this.onUpdate);   
            
            this.configure();
        }
    
        onUpdate = (thermostatInfo: ThermostatInfo) => {            
            const thermostatService = this.accessory.getService(Service.Thermostat);
            
            thermostatService.getCharacteristic(Characteristic.CurrentTemperature).setValue(thermostatInfo.currentTemp / 100, undefined, 'event');
            thermostatService.getCharacteristic(Characteristic.TargetTemperature).setValue(thermostatInfo.currentSetpoint / 100, undefined, 'event');
    
            var heatingCoolingState;
            if (thermostatInfo.burnerInfo === '1') {
                heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
            } else {
                heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
            }
    
            thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(heatingCoolingState, undefined, 'event');

            const informationService = this.accessory.getService(Service.AccessoryInformation);
            
            informationService
            .setCharacteristic(Characteristic.Name, this.config.name)        
            .setCharacteristic(Characteristic.Manufacturer, 'Eneco')
            .setCharacteristic(Characteristic.Model, "Toon")
            .setCharacteristic(Characteristic.SerialNumber, this.connection.getDisplayCommonName())        
            .setCharacteristic(Characteristic.FirmwareRevision, this.connection.getSoftwareVersion())
            .setCharacteristic(Characteristic.HardwareRevision, this.connection.getHardwareVersion());
                
        }
    
        identify(callback: () => void) {
            callback();
        }
    
        getCurrentHeatingCoolingState = (callback: (err: Error | null, value?: any) => void) => {
            const burnerInfo = this.connection.getBurnerInfo();
                    
            // Toon can only activate the heating, so return heat or off.
            var heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
    
            if (burnerInfo === '1') {
                heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
            }
            
            if (burnerInfo !== undefined) {
                callback(null, heatingCoolingState);            
            } else {
                callback(new Error("Error getting HeatingCoolingState"));
            }
        }
    
        setTargetHeatingCoolingState = (_: any, callback: (err: Error | null, value?: any) => void) => {
            callback(null, Characteristic.TargetHeatingCoolingState.AUTO);
        }
    
        getTargetHeatingCoolingState = (callback: (err: Error | null, value?: any) => void) => {
            callback(null, Characteristic.TargetHeatingCoolingState.AUTO);
        }
        
        getCurrentTemperature = (callback: (err: Error | null, value?: any) => void) => {
            const currentTemp = this.connection.getCurrentTemperature()
    
            if (currentTemp) {
                this.log("Current Temperature: ", currentTemp);
                callback(null, currentTemp);
            } else {
                callback(new Error("Error getting CurrentTemperature"));
            }
        }
    
        getTargetTemperature = (callback: (err: Error | null, value?: any) => void) => {
            const currentSetpoint = this.connection.getCurrentSetpoint();
    
            if (currentSetpoint) {
                callback(null, currentSetpoint);            
            } else {
                callback(new Error("Error getting TargetTemperature"));
            }
        }
    
        setTargetTemperature = async (value: any, callback: (err: Error | null, value?: any) => void, context: string) => {
            if (context !== 'event') {
                try {
                    await this.connection.setTemperature(value)       
                    callback(null);        
                } catch {
                    callback(new Error("Error setting TargetTemperature"));
                }
            } else {
                callback(null);
            }
        }
        
        getTemperatureDisplayUnits = (callback: (err: Error | null, value?: any) => void) => {
            callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
        }
    
        configure() {     
            if (!this.accessory.getService(Service.AccessoryInformation)) {
                this.accessory.addService(Service.AccessoryInformation, "Toon Thermostaat");
            }                
            
            const informationService = this.accessory.getService(Service.AccessoryInformation);
    
            informationService
            .setCharacteristic(Characteristic.Name, this.config.name)        
            .setCharacteristic(Characteristic.Manufacturer, 'Eneco')
            .setCharacteristic(Characteristic.Model, "Toon")
                
            if (!this.accessory.getService(Service.Thermostat)) {
                this.accessory.addService(Service.Thermostat, "Toon Thermostaat");
            }    

            const thermostatService = this.accessory.getService(Service.Thermostat);
            
            thermostatService
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .on('get', this.getCurrentHeatingCoolingState);
    
            thermostatService
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .on('set', this.setTargetHeatingCoolingState)
                .on('get', this.getTargetHeatingCoolingState);
    
            thermostatService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .on('get', this.getCurrentTemperature);
    
            thermostatService
                .getCharacteristic(Characteristic.TargetTemperature)
                .on('set', this.setTargetTemperature)
                .on('get', this.getTargetTemperature);
    
            thermostatService
                .getCharacteristic(Characteristic.TemperatureDisplayUnits)
                .on('get', this.getTemperatureDisplayUnits);
        }
    
    }