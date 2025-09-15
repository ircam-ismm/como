export default {
  // general
  masterid: {
    type: 'integer',
    min: 0,
    max: 100,
    metas: {
      description: `ID number used to identify a source module in a received OSC sensor stream. The ID number is concatenated with the OSC address, for instance: /riot/v3/0/xxxxx for the module #0. This ensures the ability to know the origin of the data even if several modules are sharing the same UDP port`
    },
  },
  samplerate: {
    type: 'integer',
    default: 5,
    min: 5,
    max: 20000,
    metas: {
      description: `Sample period of the sensors and OSC transmission, in milliseconds. Increase if you experience lag or transmission gaps when a large number of modules are used on the same Wi-Fi channel or network (default value: 5ms  200 Hz)`
    },
  },
  debug: {
    type: 'boolean',
    default: false,
    metas: {
      description: `Enables debug mode, makes the module more verbose over the USB serial console, especially at boot time.`
    }
  }
  // WiFi config
  mode: {
    type: 'enum',
    list: ['Station', 'AP'],
    default: 'Station',
    metas: {
      description: `0 for station mode (the R-IoT connects to a Wi-Fi access point), 1 for Access Point mode (the R-IoT becomes a Wi-Fi access point to which the computer connects)`,
    },
  }
  ssid: {
    type: 'string',
    default: '',
    metas: {
      description: `The name of the Wi-Fi network the R-IoT should connect to. Must match the AP / router network name`,
    },
  },
  pass: {
    type: 'string',
    default: '',
    metas: {
      description: `Wi-Fi password if security is enabled on the Wi-Fi Access Point (AP). Leave blank if no security is used. Otherwise, ensure the password is 8 to 32 characters long.`
    },
  },
  dhcp: {
    type: 'boolean',
    default: true,
    metas: {
      description: `Enables the use of DHCP (1) vs. fixed IP address (0). When using DHCP, the access point will provide the IP address to the R-IoT, if the feature is enabled on the AP. Using DHCP is the preferred and most convenient mode. When disabled, a fixed IP address will be used, specified by the parameter ownip below.`,
    }
  },
  ownip: {
    type: 'string',
    default: '',
    metas: {
      description: `Specifies the fixed IP address of the module when DHCP isn't used`,
    },
  },
  gateway: {
    type: 'string',
    default: '',
    metas: {
      description: `In a network, the gateway is in charge to route the messages and packets outside of the network, for instance for joining a destination computer over the Internet or another local network. Most of the time, the gateway is the IP address of the Wi-Fi access point, with commonly used IP addresses 192.168.1.1 or 192.168.1.254 (check your AP configuration)`,
    },
  },
  mask: {
    type: 'string',
    default: '',
    metas: {
      description: `The network mask is a filtering option that defines which IP address to take into consideration in the network. The default value of 255.255.255.0 requires all IP address to have their first 3 numbers to be the same as the network root class, for instance 192.168.1.xxx. This is the common setting for the network mask.`,
    },
  },
  // OSC stream destination
  destip: {
    type: 'string',
    default: '',
    metas: {
      description: `Destination IP address to send OSC data to. It is the computer’s IP address (default 192.168.1.100)`
    },
  },
  port: {
    type: 'integer',
    default: 8080,
    min: 1024,
    max: 49151,
    metas: {
      description: `The UDP port to which the module’s OSC data is sent. It should match the udpreceive port number of the Max/MSP object on the computer. Standard values are in the range of 8000 to 10000 however, certain restrictions exist depending on the operating system used on the computer (reserved ports & services)5. For optimum use of the Max/MSP scheduler, we recommend to use a specific port per module so that the udpreceive object has its own OSC data reception thread. Our standard numbering scheme uses the modules ID as an offset to the root port number, for instance port 8000 for module #0, 8001 for module #1 and so forth.`
    }
  },

}
