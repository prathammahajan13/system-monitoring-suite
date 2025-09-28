import { SystemMonitor, SystemMonitorConfig, SystemMetrics, Alert } from '../src/index';
import * as si from 'systeminformation';

// Mock systeminformation
jest.mock('systeminformation');

describe('SystemMonitor', () => {
  let monitor: SystemMonitor;
  const mockSi = si as jest.Mocked<typeof si>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mocks with proper types
    mockSi.currentLoad.mockResolvedValue({
      currentLoad: 25.5,
      cpus: [{ load: 25.5 }] as any,
      loadavg: [1.2, 1.5, 1.8]
    } as any);
    
    mockSi.cpuCurrentSpeed.mockResolvedValue({
      avg: 2400
    } as any);
    
    mockSi.cpuTemperature.mockResolvedValue({
      main: 45.2
    } as any);
    
    mockSi.mem.mockResolvedValue({
      total: 8589934592, // 8GB
      used: 4294967296,  // 4GB
      free: 4294967296,  // 4GB
      available: 4294967296
    } as any);
    
    mockSi.memLayout.mockResolvedValue([] as any);
    
    mockSi.fsSize.mockResolvedValue([
      {
        mount: '/',
        size: 100000000000, // 100GB
        used: 50000000000,  // 50GB
        available: 50000000000
      }
    ] as any);
    
    mockSi.networkStats.mockResolvedValue([
      {
        iface: 'eth0',
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 1000,
        tx_sec: 500
      }
    ] as any);

    monitor = new SystemMonitor();
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.stop();
    }
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(monitor).toBeInstanceOf(SystemMonitor);
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.config.interval).toBe(5000);
    });

    it('should create instance with custom config', () => {
      const config: SystemMonitorConfig = {
        interval: 1000,
        debug: true,
        environment: 'test'
      };
      const customMonitor = new SystemMonitor(config);
      const status = customMonitor.getStatus();
      expect(status.config.interval).toBe(1000);
      expect(status.config.debug).toBe(true);
      expect(status.config.environment).toBe('test');
    });
  });

  describe('start()', () => {
    it('should start monitoring', async () => {
      const startPromise = new Promise<void>((resolve) => {
        monitor.on('started', resolve);
      });

      await monitor.start();
      await startPromise;

      const status = monitor.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.uptime).toBeGreaterThan(0);
    });

    it('should not start if already running', async () => {
      await monitor.start();
      const firstUptime = monitor.getStatus().uptime;
      
      await monitor.start();
      const secondUptime = monitor.getStatus().uptime;
      
      expect(secondUptime).toBeGreaterThanOrEqual(firstUptime);
    });

    it('should emit started event', async () => {
      const startedSpy = jest.fn();
      monitor.on('started', startedSpy);

      await monitor.start();
      
      expect(startedSpy).toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('should stop monitoring', async () => {
      await monitor.start();
      expect(monitor.getStatus().isRunning).toBe(true);

      await monitor.stop();
      expect(monitor.getStatus().isRunning).toBe(false);
    });

    it('should emit stopped event', async () => {
      const stoppedSpy = jest.fn();
      monitor.on('stopped', stoppedSpy);

      await monitor.start();
      await monitor.stop();
      
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      await monitor.stop();
      expect(monitor.getStatus().isRunning).toBe(false);
    });
  });

  describe('collectMetrics()', () => {
    it('should collect and emit metrics', async () => {
      const metricsSpy = jest.fn();
      monitor.on('metricsCollected', metricsSpy);

      await monitor.start();
      
      // Wait for at least one metric collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(metricsSpy).toHaveBeenCalled();
      const metrics = metricsSpy.mock.calls[0][0] as SystemMetrics;
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('network');
    });

    it('should collect CPU metrics correctly', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      
      const latestMetric = metrics[metrics.length - 1];
      expect(latestMetric.cpu.usage).toBe(26); // Rounded from 25.5
      expect(latestMetric.cpu.cores).toBe(1);
      expect(latestMetric.cpu.temperature).toBe(45.2);
    });

    it('should collect memory metrics correctly', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = monitor.getMetrics();
      const latestMetric = metrics[metrics.length - 1];
      
      expect(latestMetric.memory.usage).toBe(50); // 4GB / 8GB * 100
      expect(latestMetric.memory.total).toBe(8589934592);
      expect(latestMetric.memory.used).toBe(4294967296);
    });

    it('should collect disk metrics correctly', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = monitor.getMetrics();
      const latestMetric = metrics[metrics.length - 1];
      
      expect(latestMetric.disk.usage).toBe(50); // 50GB / 100GB * 100
      expect(latestMetric.disk.devices).toHaveLength(1);
      expect(latestMetric.disk.devices[0].name).toBe('/');
    });
  });

  describe('getStatus()', () => {
    it('should return correct status when stopped', () => {
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.uptime).toBe(0);
      expect(status.metricsCount).toBe(0);
      expect(status.alertsCount).toBe(0);
    });

    it('should return correct status when running', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.metricsCount).toBeGreaterThan(0);
    });
  });

  describe('getMetrics()', () => {
    it('should return all metrics when no time range specified', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should return filtered metrics for time range', async () => {
      await monitor.start();
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100));
      const endTime = Date.now();
      
      const metrics = monitor.getMetrics({ from: startTime, to: endTime });
      expect(metrics.length).toBeGreaterThan(0);
      
      metrics.forEach(metric => {
        expect(metric.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(metric.timestamp).toBeLessThanOrEqual(endTime);
      });
    });
  });

  describe('getAlerts()', () => {
    it('should return empty array initially', () => {
      const alerts = monitor.getAlerts();
      expect(alerts).toEqual([]);
    });

    it('should generate alerts for high CPU usage', async () => {
      // Mock high CPU usage
      mockSi.currentLoad.mockResolvedValue({
        currentLoad: 90,
        cpus: [{ load: 90 }] as any,
        loadavg: [4.0, 4.5, 5.0]
      } as any);

      const alertSpy = jest.fn();
      monitor.on('alert', alertSpy);

      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(alertSpy).toHaveBeenCalled();
      const alert = alertSpy.mock.calls[0][0] as Alert;
      
      expect(alert.severity).toBe('emergency');
      expect(alert.metric).toBe('cpu');
      expect(alert.value).toBe(90);
    });
  });

  describe('healthCheck()', () => {
    it('should return healthy status when stopped', async () => {
      const health = await monitor.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.components.systemMonitor).toBe('unhealthy');
    });

    it('should return healthy status when running with normal metrics', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const health = await monitor.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.components.systemMonitor).toBe('healthy');
    });

    it('should return degraded status with high CPU usage', async () => {
      mockSi.currentLoad.mockResolvedValue({
        currentLoad: 85,
        cpus: [{ load: 85 }] as any,
        loadavg: [3.0, 3.5, 4.0]
      } as any);

      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const health = await monitor.healthCheck();
      expect(health.components.cpu).toBe('degraded');
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      const configSpy = jest.fn();
      monitor.on('configUpdated', configSpy);

      monitor.updateConfig({ interval: 2000, debug: true });
      
      expect(configSpy).toHaveBeenCalled();
      const status = monitor.getStatus();
      expect(status.config.interval).toBe(2000);
      expect(status.config.debug).toBe(true);
    });
  });

  describe('getAnalysis()', () => {
    it('should return null when no metrics available', () => {
      const analysis = monitor.getAnalysis();
      expect(analysis).toBeNull();
    });

    it('should return analysis when metrics available', async () => {
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const analysis = monitor.getAnalysis();
      expect(analysis).not.toBeNull();
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('trends');
      expect(analysis).toHaveProperty('averages');
    });
  });

  describe('Error Handling', () => {
    it('should emit error when systeminformation fails', async () => {
      mockSi.currentLoad.mockRejectedValue(new Error('System call failed'));
      
      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);

      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should continue running after error', async () => {
      mockSi.currentLoad.mockRejectedValueOnce(new Error('Temporary failure'));
      
      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);

      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(errorSpy).toHaveBeenCalled();
      expect(monitor.getStatus().isRunning).toBe(true);
    });
  });
});
