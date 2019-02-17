export default interface ToonConfig {
  accessory: "Toon";
  name: string;

  // Eneco login
  username: string;
  password: string;

  // Agreement Index is used to select the correct address if a user has different addresses.
  agreementIndex?: number;

  // API Keys from developer.toon.eu
  consumerKey: string;
  consumerSecret: string;
}
