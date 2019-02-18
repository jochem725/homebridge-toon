# homebridge-toon

This plugin enables homebridge to communicate with Toon.

`npm install -g homebridge-toon`

## Configuration

To make the plugin work you need to obtain an API key from developer.toon.eu
The following should be added to the homebridge config.json:

```javascript
    {
      "platforms": [
        {
          "platform": "Toon",
          "name": "<NAME>",
          "username": "<ENECO USERNAME>",
          "password": "<ENECO PASSWORD>"
          "consumerKey": "<CONSUMER KEY>",
          "consumerSecret": "<CONSUMER SECRET>"
        }
      ]
    }
```

## Agreement Selection

The plugin automatically selects the first agreement in the list, however if agreement selection is necessary, add the following config parameter.
`"agreementIndex": <NUMBER>`

The plugin automatically lists the available options in the Homebridge log.
