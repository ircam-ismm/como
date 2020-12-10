## Controller

when we change labels, it seems the drop down menu for chosing labels with recordings is not updated

# TODOS

## ScriptData.js (line: 100)

```
if (outputFrame !== undefined) {
  throw new Error(`script {scriptName} does not return outputFrame`);
}
```

## ScriptAudio

- remove `this.outputFrame`, does not make sens

