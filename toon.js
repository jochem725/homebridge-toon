var Promise = require('bluebird');
var request = Promise.promisify(require("request"));
var express = require('express');
var uuid = require('node-uuid');
var events = require('events');

function Toon(username, password, log) {
	this.username = username;
	this.password = password;
	this.log = log;
    this.emitter = new events.EventEmitter();


    this.authenticating = false;
	this.initialized = false;
	this.clientData = {};

	this.thermostatInfo = {};

	var self = this;
    self.updateToonData(self.initialized);

}

Toon.prototype = {
    login: function (username, password) {
        var self = this;

        if (self.authenticating === false) {
            self.authenticating = true;

            return Promise.resolve()
                .then (function() {
                    if (self.initialized === true) {
                        return self.logout(self.clientData);
                    }
                })
                .then(function () {
                    return self.obtainClientData(username, password)
                })
                .then(function () {
                    return self.authenticate()
                })
                .then(function() {
                    self.initialized = true;
                    self.log('Successfully logged in to Toon.')
                })
                .finally(function() {
                    self.authenticating = false;
                })
        }
    },

    logout: function (clientData) {
        var self = this;

        return request({
            url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/logout",
            method: "GET",
            qs: {
                clientId: clientData.clientId,
                clientIdChecksum: clientData.clientIdChecksum,
                random: uuid.v4()
            }})
            .then(function () {
                self.initialized = false;
                self.clientData = {};
            })
            .catch(function (e) {})
    },

    authenticate: function () {
        var self = this;
        self.log('Authenticating...');

        return request({
            url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/start",
            method: "GET",
            qs: {
                clientId: self.clientData.clientId,
                clientIdChecksum: self.clientData.clientIdChecksum,
                agreementId: self.clientData.agreements[0].agreementId,
                agreementIdChecksum: self.clientData.agreements[0].agreementIdChecksum,
                random: uuid.v4()
            },
            json: true,
            timeout: 20000
        }).then(function (response) {
                var body = response.body;
                if (response.statusCode !== 200 || body.success === false) {
                    throw new Error('There was an error authenticating with Toon.\n' + JSON.stringify(body));
                }
            })
    },

    obtainClientData: function (username, password) {
        var self = this;
        return request({
            url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/login",
            method: "POST",
            form: {
                username: username,
                password: password
            },
            json: true,
            timeout: 10000
        }).then(function (response) {
            self.log('Retrieving client data from Toon op Afstand...');
            var body = response.body;
            if (response.statusCode == 200 && (typeof body !== "undefined") && body.success === true) {
                self.clientData = body;
            } else {
                throw new Error('There was an error retrieving the client data from Toon.\n' + JSON.stringify(body));
            }
        })
    },

    updateToonData: function (initialized) {
        var self = this;

        return Promise.resolve()
            .then(function() {
                if (initialized === false) {
                    return self.login(self.username, self.password, self.initialized, self.clientData);
                }
            })
            .then(function() {
                self.log('Retrieving data update from Toon...');
                return request({
                    url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/retrieveToonState",
                    method: "GET",
                    qs: {
                        clientId: self.clientData.clientId,
                        clientIdChecksum: self.clientData.clientIdChecksum,
                        random: uuid.v4()
                    },
                    json: true,
                    timeout: 20000
                })
            })
            .then(function (response) {
                var body = response.body;
                if (response.statusCode === 200 && (typeof body !== "undefined") && body.success === true) {
                    if (body.hasOwnProperty('thermostatInfo') === true) {
                        self.thermostatInfo = body.thermostatInfo;
                        self.emitter.emit('thermostatUpdate', self.thermostatInfo)
                    }
                } else {
                    throw new Error('Received invalid response from Toon\n +' + JSON.stringify(body));
                }
            })
            .catch(function (e) {
                self.log(e);
                self.initialized = false;
            })
            .finally(function () {
                var timeout = (self.initialized === false) ? 10000 : 0;

                setTimeout(function () {
                    self.updateToonData(self.initialized);
                }, timeout);
            });
    },

    setToonTemperature: function (temperature, initialized) {
        var self = this;
        self.log('Setting Toon Temperature to ', temperature);

        var destination_temperature = Math.round(temperature * 100);
        return Promise.resolve()
            .then(function() {
                if (initialized === false) {
                    return self.login(self.username, self.password, self.initialized, self.clientData);
                }
            })
            .then(function() {
                return request({
                    url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/setPoint",
                    method: "GET",
                    qs: {
                        clientId: self.clientData.clientId,
                        clientIdChecksum: self.clientData.clientIdChecksum,
                        value: destination_temperature,
                        random: uuid.v4()
                    },
                    json: true
                })
            })
            .then(function (response) {
                var body = response.body;
                if (response.statusCode === 200 && (typeof body !== "undefined") && body.success === true) {
                    self.log('Successfully set Toon Temperature to ', temperature);
                    self.thermostatInfo.currentSetpoint = temperature * 100;
                } else {
                    throw new Error(body);
                }
            })
            .catch(function (e) {
                self.initialized = false;
                self.log('Error setting temperature', e);
            });
    },

    setTemperature: function(temperature) {
        var self = this;

        return self.setToonTemperature(temperature, self.initialized);
    },

    getThermostatInfo: function() {
        var self = this;

        return Promise.resolve()
            .then(function () {
                return self.thermostatInfo;
            });
    },

    getClientData: function() {
        var self = this;

        return Promise.resolve()
            .then(function () {
                return self.clientData;
            });
    }
};

module.exports = function(username, password, log) {
	return new Toon(username, password, log);
};
