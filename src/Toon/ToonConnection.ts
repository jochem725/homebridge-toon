import * as request from "request-promise";
import * as uuid from "node-uuid";
import ToonConfig from "../config";

export interface ToonClientData {
    agreements: {
        agreementId: number;
        agreementIdChecksum: string;
        city: string;
        displayCommonName: string;
        displayHardwareVersion: string;
        displaySoftwareVersion: string;
        houseNumber: number;
        postalCode: string;
        street: string;
        heatingType: string;
    }[],
    clientId: string;
    clientIdChecksum: string;
    passwordHash: string;
    sample: boolean;
    success: boolean;
}

export interface ThermostatInfo {
    burnerInfo: string;
    currentSetpoint: number;
    currentTemp: number;
}

interface ToonResponse {
    success: boolean;
    thermostatInfo?: ThermostatInfo;
}

export class ToonConnection {

    private initialized: boolean;
    private authenticated: boolean;
    private clientData?: ToonClientData;
    private thermostatInfo?: ThermostatInfo;
    private username: string;
    private password: string;
    private agreementIndex: number;

    constructor(private config: ToonConfig, private log: (format: string, message?: any) => void, private onUpdate: (thermostatInfo: ThermostatInfo) => void) {

        this.username = this.config.username;
        this.password = this.config.password;
        // Index selecting the agreement, if a user has multiple agreements (due to moving, etc.).
        this.agreementIndex = this.agreementIndex ? this.agreementIndex : 0;

        this.initialized = false;
        this.authenticated = false;

        this.updateToonData();
    }

    private async initialize() {
        this.initialized = await this.login();
    }

    private async login() {
        // Check if there is another session, else logout.
        if (this.initialized) {
            await this.logout();
        }

        // Obtain ClientData so we can authenticate.
        this.clientData = await this.obtainClientData(this.username, this.password);

        // Authenticate using the ClientData.
        if (this.clientData) {
            this.authenticated = await this.authenticate(this.clientData);
            this.log('Successfully logged in to Toon.')            
        }

        return this.authenticated && this.clientData !== undefined;
    }

    private async logout() {
        if (this.clientData) {
            request({
                url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/logout",
                method: "GET",
                qs: {
                    clientId: this.clientData.clientId,
                    clientIdChecksum: this.clientData.clientIdChecksum,
                    random: uuid.v4()
                }
            });
        }

        this.initialized = false;
        this.authenticated = false;
        this.clientData = undefined;
    }

    private async authenticate(clientData: ToonClientData) {
        this.log('Authenticating...');

        try {
            const response = await request({
                url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/start",
                method: "GET",
                qs: {
                    clientId: clientData.clientId,
                    clientIdChecksum: clientData.clientIdChecksum,
                    agreementId: clientData.agreements[this.agreementIndex].agreementId,
                    agreementIdChecksum: clientData.agreements[this.agreementIndex].agreementIdChecksum,
                    random: uuid.v4()
                },
                json: true,
                timeout: 20000
            });

            return response.success;
        } catch (e){
            throw new Error(`There was an error authenticating with Toon.\n${e.body}`);
        }
    }

    private async obtainClientData(username: string, password: string) {
        this.log("Retrieving client data from Toon op Afstand...");
        let clientData: ToonClientData;

        try {
            clientData = await request({
                url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/login",
                method: "POST",
                form: {
                    username,
                    password
                },
                json: true,
                timeout: 30000
            });

            if (clientData.success === true) {
                if (!this.initialized) {
                    if (this.agreementIndex < clientData.agreements.length) {
                        this.log(`Currently selected agreementIndex: ${this.agreementIndex}`);
                    } else {
                        throw new Error('Incorrect agreementIndex selected, is your config valid?');
                    }
    
                    for (const agreementIndex in clientData.agreements) {
                        const { street, houseNumber, postalCode, city, heatingType } = clientData.agreements[agreementIndex];
    
                        this.log(`agreementIndex: [${agreementIndex}]: ${street} ${houseNumber} ${postalCode} ${city} ${heatingType}`)
                    }
                }
            }
        } catch {
            throw new Error(`There was an error retrieving the client data from Toon.\n${this.clientData}`);            
        }

        return clientData;
    }

    updateToonData = async () => {
        if (!this.initialized) {
            await this.initialize()
        }

        if (this.clientData) {
            try {
                const response: ToonResponse = await request({
                    url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/retrieveToonState",
                    method: "GET",
                    qs: {
                        clientId: this.clientData.clientId,
                        clientIdChecksum: this.clientData.clientIdChecksum,
                        random: uuid.v4()
                    },
                    json: true,
                    timeout: 10000
                });

                if (response.success === true) {
                    if (response.thermostatInfo !== undefined) {
                        this.thermostatInfo = response.thermostatInfo;
                        this.onUpdate(this.thermostatInfo);
                    }
                }
            } catch (e) {
                this.logout();
            } finally {
                setTimeout(this.updateToonData, 10000);
            }
        }
    }

    private async setToonTemperature(temperature: number) {
        if (!this.initialized) {
            await this.initialize()
        }

        if (this.clientData) {
            this.log(`Setting Toon Temperature to ${temperature}`);
            const destination_temperature = Math.round(temperature * 100);
            const response = await request({
                url: "https://toonopafstand.eneco.nl/toonMobileBackendWeb/client/auth/setPoint",
                method: "GET",
                qs: {
                    clientId: this.clientData.clientId,
                    clientIdChecksum: this.clientData.clientIdChecksum,
                    value: destination_temperature,
                    random: uuid.v4(),
                    timeout: 10000
                },
                json: true
            });

            if (response.success === true) {
                this.log(`Successfully set Toon Temperature to ${temperature}`);
                if (this.thermostatInfo) {
                    this.thermostatInfo.currentSetpoint = temperature * 100;
                }
            } else {
                throw new Error(response);
            }
        }
    }

    public async setTemperature(temperature: number) {
        this.setToonTemperature(temperature);        
    }

    public getDisplayCommonName() {
        return this.clientData ? this.clientData.agreements[this.agreementIndex].displayCommonName : "-";
    }

    public getHardwareVersion() {
        return this.clientData ? this.clientData.agreements[this.agreementIndex].displayHardwareVersion : "-";
    }

    public getSoftwareVersion() {
        return this.clientData ? this.clientData.agreements[this.agreementIndex].displaySoftwareVersion : "-";
    }

    public getBurnerInfo() {
        return this.thermostatInfo ? this.thermostatInfo.burnerInfo : undefined;
    }

    public getCurrentTemperature() {
        return this.thermostatInfo ? this.thermostatInfo.currentTemp / 100 : undefined;
    }

    public getCurrentSetpoint() {
        return this.thermostatInfo ? this.thermostatInfo.currentSetpoint / 100 : undefined;
    }
}