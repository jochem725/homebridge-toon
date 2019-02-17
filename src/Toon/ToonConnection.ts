import ToonConfig from '../config';
import {
    API_URL,
    authenticateToken,
    ThermostatInfo,
    Token,
    ToonAgreement,
    toonGETRequest,
    toonPUTRequest,
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
    this.token = await authenticateToken(
      this.consumerKey,
      this.consumerSecret,
      this.username,
      this.password
    );

    this.agreement = await this.getAgreementData();
  }

  private async getAgreementData() {
    this.log("Getting agreement...");

    let agreements: ToonAgreement[] = await toonGETRequest(
      `${API_URL}agreements`,
      this.consumerKey,
      this.consumerSecret,
      this.token
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

    let toonStatus: ToonStatus = await toonGETRequest(
      `${API_URL}${this.agreement.agreementId}/status`,
      this.consumerKey,
      this.consumerSecret,
      this.token
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

    let currentThermostatInfo: ThermostatInfo = await toonGETRequest(
      `${API_URL}${this.agreement.agreementId}/thermostat`,
      this.consumerKey,
      this.consumerSecret,
      this.token
    );

    console.log(currentThermostatInfo);

    const payload = {
      ...currentThermostatInfo,
      currentSetpoint: temperature,
      activeState: -1,
      programState: 2
    };

    const newThermostatInfo = await toonPUTRequest(
      `${API_URL}${this.agreement.agreementId}/thermostat`,
      payload,
      this.consumerKey,
      this.consumerSecret,
      this.token
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
