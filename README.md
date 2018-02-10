# homebridge-toon
This plugin enables homebridge to communicate with Toon.

`npm install -g homebridge-toon`

## Configuration
The following should be added to the homebridge config.json:

    {
      "platforms": [
        {
          "platform": "Toon",
          "name": "<NAME>",
          "username": "<TOONOPAFSTAND USERNAME>",
          "password": "<TOONOPAFSTAND PASSWORD>"
        }
      ]
    }

## Agreement Selection
The plugin automatically selects the first agreement in the list, however if agreement selection is necessary, add the following config parameter. 
`"agreementIndex": <NUMBER>`

The plugin automatically lists the available options in the Homebridge log.

