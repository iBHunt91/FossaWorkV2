module.exports = {
  apps: [
    {
      name: 'fossawork-backend',
      script: 'python',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload',
      cwd: './backend',
      interpreter: 'python3',
      max_memory_restart: '4G',
      env: {
        NODE_ENV: 'development',
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1'
      },
      error_file: './logs/backend_err.log',
      out_file: './logs/backend_out.log',
      log_file: './logs/backend_combined.log',
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'fossawork-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=4096'
      },
      error_file: './logs/frontend_err.log',
      out_file: './logs/frontend_out.log',
      log_file: './logs/frontend_combined.log',
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};