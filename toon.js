var request = require("request");
var express = require('express');
var uuid = require('node-uuid');
var app = express();

function Toon(username, password) {
	this.username = username;
	this.password = password;
	
	this.sessionstate = null;
	// Contains the last response from the server.
	this.toondatastate = null;
	// Contains the last thermostat info received from the server.
	// Not always the latest data, because the server does not always return thermostat info.
	this.toonthermostatstate = null;

	var self = this;

	// Establish session for the first time and fetch the data to begin with.
	self.refreshSession(function(err) { 
		if (!err) {		
			self.getToonData(function(err, data) {
				if (!err) {
					console.log(data);
					self.toondatastate = JSON.parse(data);
					if (self.toondatastate.hasOwnProperty('thermostatInfo')) {
						self.toonthermostatstate = self.toondatastate.thermostatInfo;
					}
				}
			});
		}
	});

	// Fetch new data every 30 seconds.
	setInterval(function updateToonData() {
		self.getToonData(function(err, data) {
			if (!err) {
				console.log(data);
				self.toondatastate = JSON.parse(data);
				if (self.toondatastate.hasOwnProperty('thermostatInfo')) {
					self.toonthermostatstate = self.toondatastate.thermostatInfo;
				}
			}
		});
		
	}, 30 * 1000);
}

Toon.prototype = {

	refreshSession: function (callback) {
		var self = this;

		self.logout(function (err) {
			self.login(function (err, data) {
				if (!err) {
					callback(null, data);
				} else {
					callback(err);
				}
			});
		});
	},

	login: function (callback) {
		var self = this;

		request({
	  		url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/login",
	  		method: "POST",
	  		form: {
	    		username: self.username,
	    		password: self.password,
	  		}
	  	}, function(err, response, body) {
	  		if (!err && response.statusCode == 200) {
		  		self.sessionstate = JSON.parse(body);
				request({
			  		url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/start",
			  		method: "GET",
			  		qs: {
			    		clientId: self.sessionstate.clientId,
			    		clientIdChecksum: self.sessionstate.clientIdChecksum,
			    		agreementId: self.sessionstate.agreements[0].agreementId,
			    		agreementIdChecksum: self.sessionstate.agreements[0].agreementIdChecksum,
			    		random: uuid.v4()
			  		}
			  	}, function(err, response, body) {
			  		if (!err && response.statusCode == 200) {
						callback(null, body);
					} else {
						callback(err);
					}
			  	});	
		  	} else {
		  		callback(err);
		  	}
		  });
	},

	logout: function (callback) {
		var self = this;

		if (self.sessionstate !== null) {
			request({
	  			url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/logout",
	  			method: "GET",
	  			qs: {
	  				clientId: self.sessionstate.clientId,
			    	clientIdChecksum: self.sessionstate.clientIdChecksum,
			    	random: uuid.v4()
	  			}
	  		}, function(err, response, body) {
		  		if (!err && response.statusCode == 200) {
		  			self.sessionstate = null;
		  			callback(null);
		 		} else {
		 			callback(err);
		 		}
	  		});			
		} else {
			callback(false);
		}
	},

	getToonData: function (callback) {
		var self = this;
		if (self.sessionstate !== null) {
			request({
		  		url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/retrieveToonState",
		  		method: "GET",
		  		qs: {
				    		clientId: self.sessionstate.clientId,
				    		clientIdChecksum: self.sessionstate.clientIdChecksum,
				    		random: uuid.v4()
		  		}
		  	}, function(err, response, body) {
		  		if (!err && response.statusCode == 200) {
		  			callback(null, body);
		  		} else {
		  			callback(err);
		  		}
			});
		} else {
			callback(new Error("No active session."));
		}		  		
	},

	setToonTemperature: function (temp, callback) {
		var self = this;
		var temperature = Math.round(temp * 100);

		if (self.sessionstate !== null) {
			request({
		  		url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/setPoint",
		  		method: "GET",
		  		qs: {
				    		clientId: self.sessionstate.clientId,
				    		clientIdChecksum: self.sessionstate.clientIdChecksum,
				    		value: temperature,
				    		random: uuid.v4()
		  		}
		  	}, function(err, response, body) {
		  		if (!err && response.statusCode == 200) {
		  			callback(null);	
		  		} else {
		  			callback(err);	
		  		}
		  	});		
		} else {
			callback(new Error("No active session"));
		} 	
	},

	setToonState: function (state, callback) {
		// 0 -> Comfort
		// 1 -> Thuis
		// 2 -> Slapen
		// 3 -> Weg
		// 4 -> Vakantie
		var self = this;
			
		if (self.sessionstate !== null) {			
			request({
			  		url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/schemeState",
			  		method: "GET",
			  		qs: {
					    		clientId: self.sessionstate.clientId,
					    		clientIdChecksum: self.sessionstate.clientIdChecksum,
					    		state: 2,
					    		temperatureState: state,
					    		random: uuid.v4()
			  		}
			  	}, function(err, response, body) {
			  		if (!err && response.statusCode == 200) {
			  			callback(null);
			  		} else {
			  			callback(err);
			  		}
			  });			
		} else {
			callback(new Error("No active session"));
		}
	}	 	
};	

module.exports = Toon;
