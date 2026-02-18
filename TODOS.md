- [ ] `scriptName` & `scriptSharedStateClassName` are not updated at the sae time which is confusing
  + workaround `scriptNameRequest` -> [`scriptName` & `scriptSharedStateClassName`]
- [ ] implement `player.getScriptSharedState`
- [ ]
    allow to `playerManager.getPlayer` to have player instances that do not mirror the script
    OR `playerManager.getPlayerState()`


- [ ] make sure projects directory can live alongside (not within) the application
- [ ] documentation
- [ ] template generator
  + [x] merge @soundworks/create cf. https://github.com/collective-soundworks/soundworks-create/pull/10

- [x] review scripting
- [x] confirm on delete project & session
- [x] expose node-web-audio-api on `globalThis`
- [x] prototype synth layer (in como-health)

- [x] rename 'source.stream' to 'frame'
- [x] add soundworks as peer dependency
- [x] record streams - tag with synchronized time
- [x] rename `FilePlayerSource` to `StreamPlayerSource`
- [x] move `get id()` in `AbstractSource`
- [ ] `StreamPlayerSource` -
  + [x] implement play / pause,
  + [x] loop
  + [ ] seek
  + [ ] loop start / loop end
- [x] Implement project manager
- [x] Move `RecordingManager` within `SourceManager`
- [x] sketch scripts : `enter` / `exit` / `defineParams` / `process`
- [ ] Implement SoundBankManager
- [ ] add test for source recording
- [ ] Errors issues - are swallowed somehow...
  + [ ] `como.setProject`
  + [ ] `Player.setScript`
- [x] review `como.setProject` api
- [ ] release comote-helpers
- [ ] check options for all sources
- [ ] name components at registration

- [ ] save topology

- [ ] fix `instanceof` issue with peer dependency check in local (npm link)
- [ ] check https://github.com/dbrekalo/validate-types for commands validation



- [x] R-IoT 2 source (JIP)
- [x] Algo - sc-motion
  + [x] review API
  + [x] Orientation / Gravity
  + [x] Intensity


