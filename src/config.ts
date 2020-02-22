export default interface ToonConfig {
  accessory: "Toon";
  name: string;

  // Agreement Index is used to select the correct address if a user has different addresses.
  agreementIndex?: number;

  // API token from https://api.toon.eu/toonapi-accesstoken?tenant_id=eneco&client_id=<consumer_key>
  apiToken: string;
}
