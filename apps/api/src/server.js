const http = require('node:http');
const { MemoryPersistence } = require('./infra/persistence');
const { createApp } = require('./app');

const port = Number(process.env.PORT || 8080);
const persistence = new MemoryPersistence();
const store = persistence.store;
const server = http.createServer(createApp({ store, persistence }));

server.listen(port, () => {
  console.log(`CarbonBridge API prototype listening on http://localhost:${port}`);
  console.log('Demo actor headers: x-demo-user=user-buyer (default), x-demo-user=user-seller');
});

function shutdown(signal) {
  console.log(`${signal}: stopping CarbonBridge API`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { server, store };
