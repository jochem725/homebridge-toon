interface ToonConfig {
    accessory: "Toon";
    name: string;
    username: string;
    password: string;
    agreementIndex: number;
}

class ToonAccessory {

    agreementIndex: number;

    constructor(private log: (message: string) => void, private config: ToonConfig) {
        
        // Index selecting the agreement, if a user has multiple agreements (due to moving, etc.).
        this.agreementIndex = this.config.agreementIndex ? 0 : this.config.agreementIndex;

        // INITIALIZE TOON HERE.
       
        this.log("Toon Initialized, it may take a few minutes before any data will be visible to HomeKit.");        
    }

};