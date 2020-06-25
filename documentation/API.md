# API.md

To be reviewed / completed...

## CoMo

`const como = new CoMo(soundworksServer, projectsDirectory, projectName)`

`await como.init(config)`
> must be called after `soundworks.init()`

`await como.start`
> must be called after `soundworks.start()`

`como.configureExperience(soundworks.Experience)`
> require services, etc. that the experience needs to run `como`

#### server only

`como.addClient(client)`
> register a client of como, mut be called in `exerience.enter(client)`

`como.deleteClient(client)`
> register a client of como, mut be called in `exerience.exit(client)`

## CoMo.project







------------------------------------------
## CoMo.Client

como.project =>  { 
  audioFiles: [],
  presets: [{}],
  sessions: [<uuid, name>]
  metas: {},
}

como.project.observe((<uuid, name>) => {}) :
como.project.getValues();
como.project.get(name);

async como.project.createSession(name, preset) : uuid
async como.project.deleteSession(uuid) : 
async como.project.attachSession(uuid) : Session


/* test */

session<Session>.subscribe((updates) => {
  mlPresets: {

  },
  audioFiles: {

  },
});

async session<Session>.updateParam({ updates })

async session<Session>.setAudioFiles([{ label, url}, ... ]);

async session<Session>.model.clearAllExamples();

async session<Session>.model.clearLabeledExamples(name)

async session<Session>.model.train();

async session<Session>.model.decode();


// sketch, not sure it's responsiblity of the projet or the player
// maybe something like :

projectModules = project<Session>.instanciateModules({
  paramOverrides // aka override default source for networked datasource
});

projectModules.connect()

// projectModules.route('dataSource', nodeId);


projectModules['recording'].setState(state); 
// state: ['idle', 'armed', 'recording', 'pending', 'confirm', 'cancel'];

projectModule['recording'].addExampleToProject();

projectModule['recording'].filter(recordings)


dataSource --> resampler --> descriptors

