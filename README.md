# `como-lib`

> high-level framework based on soundworks dedicated at creating CoMo applications.

An application template is available at https://github.com/ircam-ismm/como-template

## Warning

__This library is under heavy developmment__

## TODOS

- ML: examples, model and config should be linked to ML nodes and not to session
  + @note: will break API
- time tag of sensors should use a high resolution clock (needs 2 sync processes?)
- audio files
  + tag files that should be preloaded at beginning
  + handle active / inactive files
- graph
  + implement deleteNode / deleteConnection
  + clean server-side (sub-)graph instanciation 
- rename `Module` to `Node`
- review script nodes to allow generation of controls GUIs
- add preset format check

