# soundworks-service-template

> template project for starting the development of a new soundworks service

linked libraries

```
npm link @soundworks/service-audio-buffer-loader @soundworks/service-checkin @soundworks/service-file-system @soundworks/service-platform @soundworks/service-sync @soundworks/service-scripting
```


## TODOS

- ML: examples, model and config should be linked to ML nodes and not to session
  + will break API

- time tag of sensors should use a high resolution clock (needs 2 sync processes?)
- 
- audio files
  + tag files that should be preloaded at beginning
  + handle active / inactive files

- graph
  + implement deleteNode / deleteConnection
  + clean server-side (sub-)graph instanciation 

- rename `Module` to `Node`

- the session filename shoule be readable... (cf. src/server/Project.js:)

- review script nodes to allow generation of controls GUIs

- DB -> should queue writes to avoid file corruption
