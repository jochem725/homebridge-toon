# homebridge-toon

This plugin enables homebridge to communicate with Toon.

`npm install -g homebridge-toon`


## Configuration

To make the plugin work you need to obtain a `consumer_key` from developer.toon.eu
The following should be added to the homebridge config.json:

An API token which is valid for 10 years can be obtained via
`https://api.toon.eu/toonapi-accesstoken?tenant_id=eneco&client_id=<consumer_key>`

```javascript
    {
      "platforms": [
        {
          "platform": "Toon",
          "name": "<NAME>",
          "apiToken": "<API TOKEN FROM>",
        }
      ]
    }
```

## Agreement Selection

The plugin automatically selects the first agreement in the list, however if agreement selection is necessary, add the following config parameter.
`"agreementIndex": <NUMBER>`

The plugin automatically lists the available options in the Homebridge log.
