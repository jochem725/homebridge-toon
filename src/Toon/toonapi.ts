export const BASE_URL = "https://api.toon.eu/";
export const API_URL = `${BASE_URL}toon/v3/`;

export interface ToonAuthorize {
  tenant_id: "eneco";
  response_type: "code";
  redirect_uri: "http://127.0.0.1";
  client_id: string;
}

export interface ToonAuthorizeLegacy {
  username: string;
  password: string;
  tenant_id: "eneco";
  response_type: "code";
  client_id: string;
  state: "";
  scope: "";
}

export interface TokenParams {
  client_id: string;
  client_secret: string;
  grant_type: "authorization_code" | "refresh_token";
  code?: string;
  refresh_token?: string;
}

export interface Token {
  issued_at: number;
  access_token: string;
  refresh_token_expires_in: string;
  expires_in: number;
  refresh_token: string;
}

export interface ToonAgreement {
  agreementId: number;
  agreementIdChecksum: string;
  street: string;
  houseNumber: number;
  postalCode: string;
  city: string;
  heatingType: string;
  displayCommonName: string;
  displayHardwareVersion: string;
  displaySoftwareVersion: string;
  isToonSolar: boolean;
  isToonly: false;
}

export interface ToonStatus {
  thermostatInfo: ThermostatInfo;
}

export interface ThermostatInfo {
  currentDisplayTemp: number;
  currentSetpoint: number;
  programState: number;
  activeState: number;
  nextProgram: number;
  nextState: number;
  nextTime: number;
  nextSetpoint: number;
  errorFound: number;
  boilerModuleConnected: number;
  burnerInfo: string;
  otCommError: string;
  currentModulationLevel: number;
}
