# Webview JavaScript API

The webview aims at being the extension point of the CoMote application.

The following API is exposed for Web pages running in the Comote webview.

## window.sendEvent(key, value)

Send a control event from the webview to the native app, events will be
propagated in the `controls` key of the OSC ar WebSocket.

Enable to extend the application with dedicated control interface

| param         |      type      |  description |
| ------------- | ----------- | ---- |
| `key` | String | name of the event |
| `value` | String | value of the event |

## window.addEventListener('comote', callback)

The 'comote' event propagated by `window` allows to listen for the stream of sensors
within the webview.

```js
window.addEventListener('comote', e => {
  const frame = e.detail;
  // do something with sensors data
});
```

## window.toggleModal()

Toggle fullscreen

## window.setModal(value)

Explicitly control the fullscreen behavior

| param         |      type      |  description |
| ------------- | ----------- | ---- |
| `value` | Boolean | name of the event |

