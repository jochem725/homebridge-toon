# homebridge-toon
This plugin enables homebridge to communicate with Toon.

The following should be added to the homebridge config.json:

    {
      "accessories": [
        {
          "accessory": "Toon",
          "name": "<NAME>",
          "username": "<TOONOPAFSTAND USERNAME>",
          "password": "<TOONOPAFSTAND PASSWORD>"
        }
      ]
    }
