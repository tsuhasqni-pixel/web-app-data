import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  testMatch:'**/*.e2e.mjs',
  timeout:60000,
  expect:{timeout:10000},
  workers:1,
  use:{
    baseURL:'http://127.0.0.1:4173',
    headless:true,
    acceptDownloads:true
  },
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 4173',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:false,
    timeout:120000
  }
});
