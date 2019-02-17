import { RequestResponse } from 'request';
import * as request from 'request-promise';

import ToonConfig from '../config';
import {
  API_URL,
  BASE_URL,
  ThermostatInfo,
  Token,
  ToonAgreement,
  ToonAuthorize,
  ToonAuthorizeLegacy,
  ToonStatus,
} from './toonapi';

export class ToonConnection {
  private agreement?: ToonAgreement;
  private toonStatus?: ToonStatus;
  private username: string;
  private password: string;
  private agreementIndex: number;

  private token?: Token;

  private consumerKey: string;
  private consumerSecret: string;

  constructor(
    private config: ToonConfig,
    private log: (format: string, message?: any) => void,
    private onUpdate: (toonStatus: ToonStatus) => void
  ) {
    this.username = this.config.username;
    this.password = this.config.password;

    this.consumerKey = this.config.consumerKey;
    this.consumerSecret = this.config.consumerSecret;

    // Index selecting the agreement, if a user has multiple agreements (due to moving, etc.).
    this.agreementIndex = this.config.agreementIndex
      ? this.config.agreementIndex
      : 0;

    this.initialize().then(() => {
      setInterval(this.getToonStatus, 10000);
    });
  }

  private async initialize() {
    this.token = await this.authenticateToken();
    this.agreement = await this.getAgreementData();
  }

  private async authenticateToken() {
    const code = await this.getChallengeCode();
    const payload = {
      client_id: this.consumerKey,
      client_secret: this.consumerSecret,
      grant_type: "authorization_code",
      code
    };

    return this.requestToken(payload);
  }

  private async refreshToken() {
    if (!this.token) {
      throw Error("Attempt to refresh token without authentication token.");
    }

    if (Date.now() - this.token.issued_at > this.token.expires_in * 1000) {
      const payload = {
        client_id: this.consumerKey,
        client_secret: this.consumerSecret,
        grant_type: "refresh_token",
        refresh_token: this.token.refresh_token
      };

      this.token = await this.requestToken(payload);
    }
  }

  private async requestToken(payload: any): Promise<Token> {
    const token = await request({
      url: `${BASE_URL}token`,
      method: "POST",
      form: payload,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      json: true
    });

    return {
      ...token,
      issued_at: Date.now()
    };
  }

  private getHeader(token: Token) {
    return {
      Authorization: `Bearer ${token.access_token}`,
      "content-type": "application/json",
      "cache-control": "no-cache"
    };
  }

  private async toonPUTRequest(url: string, body: any) {
    if (this.token === undefined) {
      throw Error("PUT not authorized");
    }

    await this.refreshToken();

    const result = await request({
      url,
      method: "PUT",
      headers: this.getHeader(this.token),
      body: JSON.stringify(body)
    });

    return JSON.parse(result);
  }

  private async toonGETRequest(url: string) {
    if (this.token === undefined) {
      throw Error("GET not authorized");
    }

    const requestToken = await this.refreshToken();

    return await request({
      url,
      method: "GET",
      headers: this.getHeader(this.token),
      json: true
    });
  }

  private async getChallengeCode() {
    // Go to the authorize page.
    const authorizeParams: ToonAuthorize = {
      tenant_id: "eneco",
      response_type: "code",
      redirect_uri: "http://127.0.0.1",
      client_id: this.consumerKey
    };

    await request({
      url: `${BASE_URL}authorize`,
      method: "GET",
      qs: authorizeParams
    });

    const formParams: ToonAuthorizeLegacy = {
      username: this.username,
      password: this.password,
      tenant_id: "eneco",
      response_type: "code",
      client_id: this.consumerKey,
      state: "",
      scope: ""
    };

    // Now get the code.
    const response: RequestResponse = await request({
      url: `${BASE_URL}authorize/legacy`,
      method: "POST",
      form: formParams,
      resolveWithFullResponse: true,
      simple: false
    });

    const location = response.headers["location"] as string;

    if (response.statusCode === 302 && location) {
      try {
        return location.split("code=")[1].split("&scope=")[0];
      } catch {
        throw Error(`Error while authorizing, please check your credentials.`);
      }
    } else {
      throw Error(`Authentication error ${response.statusCode}.`);
    }
  }

  private async getAgreementData() {
    this.log("Getting agreement...");

    let agreements: ToonAgreement[] = await this.toonGETRequest(
      `${API_URL}agreements`
    );

    if (this.agreementIndex < agreements.length) {
      this.log(`Currently selected agreementIndex: ${this.agreementIndex}`);
      return agreements[this.agreementIndex];
    } else {
      for (const agreementIndex in agreements) {
        const {
          street,
          houseNumber,
          postalCode,
          city,
          heatingType
        } = agreements[agreementIndex];

        this.log(
          `agreementIndex: [${agreementIndex}]: ${street} ${houseNumber} ${postalCode} ${city} ${heatingType}`
        );
      }

      throw new Error(
        "Incorrect agreementIndex selected, is your config valid?"
      );
    }
  }

  private getToonStatus = async () => {
    if (!this.agreement) {
      throw Error("Requested status but there is no agreement.");
    }

    let toonStatus: ToonStatus = await this.toonGETRequest(
      `${API_URL}${this.agreement.agreementId}/status`
    );

    if (toonStatus.thermostatInfo) {
      this.toonStatus = toonStatus;
      this.onUpdate(this.toonStatus);
    }
  };

  private async setToonTemperature(temperature: number) {
    if (!this.agreement) {
      throw Error("Setting temperature but there is no agreement.");
    }

    if (!this.toonStatus) {
      throw Error("Setting temperature but there is no status information.");
    }

    this.log(`Setting Toon Temperature to ${temperature / 100}`);

    let currentThermostatInfo: ThermostatInfo = await this.toonGETRequest(
      `${API_URL}${this.agreement.agreementId}/thermostat`
    );

    const payload = {
      ...currentThermostatInfo,
      currentSetpoint: temperature,
      activeState: -1,
      programState: 2
    };

    const newThermostatInfo = await this.toonPUTRequest(
      `${API_URL}${this.agreement.agreementId}/thermostat`,
      payload
    );

    this.log(`Successfully set Toon Temperature to ${temperature / 100}`);

    this.toonStatus.thermostatInfo = newThermostatInfo;
    this.onUpdate(this.toonStatus);
  }

  public async setTemperature(temperature: number) {
    const destination_temperature = Math.round(
      (Math.round(temperature * 2) / 2) * 100
    );

    await this.setToonTemperature(destination_temperature);
  }

  public getDisplayCommonName() {
    return this.agreement ? this.agreement.displayCommonName : "-";
  }

  public getHardwareVersion() {
    return this.agreement ? this.agreement.displayHardwareVersion : "-";
  }

  public getSoftwareVersion() {
    return this.agreement ? this.agreement.displaySoftwareVersion : "-";
  }

  public getBurnerInfo() {
    return this.toonStatus
      ? this.toonStatus.thermostatInfo.burnerInfo
      : undefined;
  }

  public getCurrentTemperature() {
    return this.toonStatus
      ? this.toonStatus.thermostatInfo.currentDisplayTemp / 100
      : undefined;
  }

  public getCurrentSetpoint() {
    return this.toonStatus
      ? this.toonStatus.thermostatInfo.currentSetpoint / 100
      : undefined;
  }
}
