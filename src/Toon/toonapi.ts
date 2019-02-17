import { RequestResponse } from 'request';
import * as request from 'request-promise';

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

export async function authenticateToken(
  client_id: string,
  client_secret: string,
  username: string,
  password: string
) {
  const code = await getChallengeCode(username, password, client_id);
  const payload = {
    client_id,
    client_secret,
    grant_type: "authorization_code",
    code
  };

  return requestToken(payload);
}

export async function refreshToken(
  client_id: string,
  client_secret: string,
  token: Token
) {
  if (Date.now() - token.issued_at > token.expires_in * 1000) {
    const payload = {
      client_id,
      client_secret,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token
    };

    return requestToken(payload);
  } else {
    return token;
  }
}

export async function requestToken(payload: any): Promise<Token> {
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

function getHeader(token: Token) {
  return {
    Authorization: `Bearer ${token.access_token}`,
    "content-type": "application/json",
    "cache-control": "no-cache"
  };
}

export async function toonPUTRequest(
  url: string,
  body: any,
  client_id: string,
  client_secret: string,
  token?: Token
) {
  if (token === undefined) {
    throw Error("PUT not authorized");
  }

  const requestToken = await refreshToken(client_id, client_secret, token);
  const result = await request({
    url,
    method: "PUT",
    headers: getHeader(requestToken),
    body: JSON.stringify(body)
  });

  return JSON.parse(result);
}

export async function toonGETRequest(
  url: string,
  client_id: string,
  client_secret: string,
  token?: Token
) {
  if (token === undefined) {
    throw Error("GET not authorized");
  }

  const requestToken = await refreshToken(client_id, client_secret, token);

  return await request({
    url,
    method: "GET",
    headers: getHeader(requestToken),
    json: true
  });
}

async function getChallengeCode(
  username: string,
  password: string,
  client_id: string
) {
  // Go to the authorize page.
  const authorizeParams: ToonAuthorize = {
    tenant_id: "eneco",
    response_type: "code",
    redirect_uri: "http://127.0.0.1",
    client_id
  };

  await request({
    url: `${BASE_URL}authorize`,
    method: "GET",
    qs: authorizeParams
  });

  const formParams: ToonAuthorizeLegacy = {
    username,
    password,
    tenant_id: "eneco",
    response_type: "code",
    client_id,
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
