# Ontology


## `ComoNode`

- A node / device in the network

## `Project`

- Set of soundfiles, scripts and sessions,
- Only 1 project can run at a given time

### File structure

```sh
[project-slug]
  project-infos.json
  soundfiles/
  scripts/
  recordings/
  presets/
  sessions/
    [session-slug]
      soundfiles.json
      infos.json
```

## `Session`

- Subset of project soundfiles
- Default script
- Set of players
- Placeholder for managers' data (e.g. xmm)

## `Player`

- Associated to a Node
- Link a Source with a Script

## `Source`

- A source of motion sensors
- <https://github.com/ircam-ismm/sc-motion/blob/main/FORMAT.md>

## `Script`

- Dynamic script to process Sources and make noises

## `Topology`

:::warning
Not implemented yet
:::

- Associate devices (cf. como.id) to players and sessions
- Can be stored and recalled
