module.exports = {
  apps: [{
    name: 'balatrolator',
    script: 'server.mjs',
    cwd: 'C:\\Users\\slmlm2009\\Desktop\\Github\\balatrolator',
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
}