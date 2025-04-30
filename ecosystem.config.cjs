module.exports = {
  apps: [{
    name: 'fossa-monitor',
    script: 'server.js',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production'
    }
  }]
} 