export default {
  env: {
    port: 8081,
    serverAddress: '127.0.0.1',
    useHttps: false,
    verbose: false,
  },
  app: {
    clients: {
      'test': {
        runtime: 'node',
      },
    },
  }
};
