// Test setup file

// Mock systeminformation to avoid actual system calls in tests
jest.mock('systeminformation', () => ({
  currentLoad: jest.fn().mockResolvedValue({
    currentLoad: 25.5,
    cpus: [{ load: 25.5 }]
  }),
  cpuCurrentSpeed: jest.fn().mockResolvedValue({
    avg: 2400
  }),
  cpuTemperature: jest.fn().mockResolvedValue({
    main: 45.2
  }),
  mem: jest.fn().mockResolvedValue({
    total: 8589934592, // 8GB
    used: 4294967296,  // 4GB
    free: 4294967296,  // 4GB
    available: 4294967296
  }),
  memLayout: jest.fn().mockResolvedValue({
    total: 0,
    used: 0,
    free: 0
  }),
  fsSize: jest.fn().mockResolvedValue([
    {
      mount: '/',
      size: 100000000000, // 100GB
      used: 50000000000,  // 50GB
      available: 50000000000
    }
  ]),
  networkStats: jest.fn().mockResolvedValue([
    {
      iface: 'eth0',
      rx_bytes: 1000000,
      tx_bytes: 500000,
      rx_sec: 1000,
      tx_sec: 500
    }
  ])
}));

// Global test timeout
jest.setTimeout(10000);
