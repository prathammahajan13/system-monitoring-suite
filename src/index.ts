import { EventEmitter } from 'events';
import * as si from 'systeminformation';

// Type definitions
export interface SystemMonitorConfig {
  interval?: number;
  enabled?: boolean;
  debug?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  environment?: 'development' | 'production' | 'test';
  metrics?: {
    cpu?: {
      enabled?: boolean;
      interval?: number;
      thresholds?: {
        warning?: number;
        critical?: number;
        emergency?: number;
      };
      retention?: number;
    };
    memory?: {
      enabled?: boolean;
      interval?: number;
      thresholds?: {
        warning?: number;
        critical?: number;
        emergency?: number;
      };
      retention?: number;
    };
    disk?: {
      enabled?: boolean;
      interval?: number;
      thresholds?: {
        warning?: number;
        critical?: number;
        emergency?: number;
      };
      retention?: number;
    };
    network?: {
      enabled?: boolean;
      interval?: number;
      thresholds?: {
        warning?: number;
        critical?: number;
        emergency?: number;
      };
      retention?: number;
    };
  };
  alerts?: {
    enabled?: boolean;
    cooldownPeriod?: string;
    maxAlertsPerHour?: number;
    escalationEnabled?: boolean;
  };
}

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
    loadAverage?: number[];
  };
  memory: {
    usage: number;
    total: number;
    used: number;
    free: number;
    available: number;
    swap?: {
      total: number;
      used: number;
      free: number;
    };
  };
  disk: {
    usage: number;
    total: number;
    used: number;
    free: number;
    devices: Array<{
      name: string;
      usage: number;
      total: number;
      used: number;
      free: number;
    }>;
  };
  network: {
    interfaces: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
      packetsReceived: number;
      packetsSent: number;
    }>;
  };
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'warning' | 'critical' | 'emergency';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  resolved?: boolean;
}

export interface SystemStatus {
  isRunning: boolean;
  uptime: number;
  startTime: number;
  config: SystemMonitorConfig;
  metricsCount: number;
  alertsCount: number;
  lastMetricTime?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    systemMonitor: 'healthy' | 'degraded' | 'unhealthy';
    cpu: 'healthy' | 'degraded' | 'unhealthy';
    memory: 'healthy' | 'degraded' | 'unhealthy';
    disk: 'healthy' | 'degraded' | 'unhealthy';
    network: 'healthy' | 'degraded' | 'unhealthy';
  };
  metrics: {
    uptime: number;
    metricsCollected: number;
    alertsGenerated: number;
    lastMetricTime?: number;
  };
  timestamp: number;
}

export class SystemMonitor extends EventEmitter {
  private isRunning: boolean = false;
  private intervalId?: ReturnType<typeof setInterval>;
  private config: Required<SystemMonitorConfig>;
  private startTime: number = 0;
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private lastNetworkStats: any = {};

  constructor(config: SystemMonitorConfig = {}) {
    super();
    this.config = this.mergeDefaultConfig(config);
  }

  private mergeDefaultConfig(config: SystemMonitorConfig): Required<SystemMonitorConfig> {
    const defaultConfig: Required<SystemMonitorConfig> = {
      interval: 5000,
      enabled: true,
      debug: false,
      logLevel: 'info',
      environment: 'development',
      metrics: {
        cpu: {
          enabled: true,
          interval: 5000,
          thresholds: { warning: 70, critical: 85, emergency: 95 },
          retention: 7
        },
        memory: {
          enabled: true,
          interval: 5000,
          thresholds: { warning: 80, critical: 90, emergency: 95 },
          retention: 7
        },
        disk: {
          enabled: true,
          interval: 10000,
          thresholds: { warning: 80, critical: 90, emergency: 95 },
          retention: 7
        },
        network: {
          enabled: true,
          interval: 5000,
          thresholds: { warning: 1000, critical: 2000, emergency: 5000 },
          retention: 7
        }
      },
      alerts: {
        enabled: true,
        cooldownPeriod: '5m',
        maxAlertsPerHour: 20,
        escalationEnabled: true
      }
    };

    // Merge config
    return {
      ...defaultConfig,
      ...config,
      metrics: {
        ...defaultConfig.metrics,
        ...config.metrics,
        cpu: { ...defaultConfig.metrics.cpu, ...config.metrics?.cpu },
        memory: { ...defaultConfig.metrics.memory, ...config.metrics?.memory },
        disk: { ...defaultConfig.metrics.disk, ...config.metrics?.disk },
        network: { ...defaultConfig.metrics.network, ...config.metrics?.network }
      },
      alerts: {
        ...defaultConfig.alerts,
        ...config.alerts
      }
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    
    try {
      this.startTime = Date.now();
      this.isRunning = true;
      
      // Initial network stats for comparison
      if (this.config.metrics.network.enabled) {
        try {
          this.lastNetworkStats = await si.networkStats();
        } catch (error) {
          this.lastNetworkStats = [];
        }
      }
      
      this.intervalId = setInterval(async () => {
        try {
          await this.collectMetrics();
        } catch (error) {
          this.emit('error', error);
        }
      }, this.config.interval);
      
      if (this.config.debug) {
        console.log('SystemMonitor started');
      }
      this.emit('started');
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    if (this.config.debug) {
      console.log('SystemMonitor stopped');
    }
    this.emit('stopped');
  }

  private async collectMetrics(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      const timestamp = Date.now();
      const metrics: SystemMetrics = {
        timestamp,
        cpu: await this.getCpuMetrics(),
        memory: await this.getMemoryMetrics(),
        disk: await this.getDiskMetrics(),
        network: await this.getNetworkMetrics()
      };
      
      this.metrics.push(metrics);
      this.cleanupOldMetrics();
      
      // Check for alerts
      if (this.config.alerts.enabled) {
        await this.checkAlerts(metrics);
      }
      
      this.emit('metrics', metrics);
      this.emit('metricsCollected', metrics);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    if (!this.config.metrics.cpu.enabled) {
      return { usage: 0, cores: 0 };
    }

    try {
      const [cpu, cpuCurrentSpeed, cpuTemperature] = await Promise.all([
        si.currentLoad(),
        si.cpuCurrentSpeed(),
        si.cpuTemperature().catch(() => null)
      ]);

      return {
        usage: Math.round(cpu.currentLoad),
        cores: cpu.cpus.length,
        temperature: cpuTemperature?.main || undefined,
        loadAverage: (cpu as any).loadavg || []
      };
    } catch (error) {
      this.emit('error', new Error(`Failed to get CPU metrics: ${error}`));
      return { usage: 0, cores: 0 };
    }
  }

  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    if (!this.config.metrics.memory.enabled) {
      return { usage: 0, total: 0, used: 0, free: 0, available: 0 };
    }

    try {
      const mem = await si.mem();
      
      return {
        usage: Math.round((mem.used / mem.total) * 100),
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        swap: undefined
      };
    } catch (error) {
      this.emit('error', new Error(`Failed to get memory metrics: ${error}`));
      return { usage: 0, total: 0, used: 0, free: 0, available: 0 };
    }
  }

  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    if (!this.config.metrics.disk.enabled) {
      return { usage: 0, total: 0, used: 0, free: 0, devices: [] };
    }

    try {
      const fsSize = await si.fsSize();
      const totalSize = fsSize.reduce((sum, fs) => sum + fs.size, 0);
      const totalUsed = fsSize.reduce((sum, fs) => sum + fs.used, 0);
      const totalFree = fsSize.reduce((sum, fs) => sum + fs.available, 0);
      
      return {
        usage: totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0,
        total: totalSize,
        used: totalUsed,
        free: totalFree,
        devices: fsSize.map(fs => ({
          name: fs.mount,
          usage: fs.size > 0 ? Math.round((fs.used / fs.size) * 100) : 0,
          total: fs.size,
          used: fs.used,
          free: fs.available
        }))
      };
    } catch (error) {
      this.emit('error', new Error(`Failed to get disk metrics: ${error}`));
      return { usage: 0, total: 0, used: 0, free: 0, devices: [] };
    }
  }

  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    if (!this.config.metrics.network.enabled) {
      return { interfaces: [] };
    }

    try {
      const networkStats = await si.networkStats();
      const currentTime = Date.now();
      
      const interfaces = networkStats.map(iface => {
        return {
          name: iface.iface,
          bytesReceived: iface.rx_bytes || 0,
          bytesSent: iface.tx_bytes || 0,
          packetsReceived: iface.rx_sec || 0,
          packetsSent: iface.tx_sec || 0
        };
      });
      
      this.lastNetworkStats = networkStats;
      
      return { interfaces };
    } catch (error) {
      this.emit('error', new Error(`Failed to get network metrics: ${error}`));
      return { interfaces: [] };
    }
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts: Alert[] = [];

    // CPU alerts
    if (this.config.metrics.cpu.enabled) {
      const cpuUsage = metrics.cpu.usage;
      const thresholds = this.config.metrics.cpu.thresholds;
      
      if (cpuUsage >= thresholds.emergency) {
        alerts.push(this.createAlert('cpu', cpuUsage, thresholds.emergency, 'emergency', `CPU usage is critically high: ${cpuUsage}%`));
      } else if (cpuUsage >= thresholds.critical) {
        alerts.push(this.createAlert('cpu', cpuUsage, thresholds.critical, 'critical', `CPU usage is high: ${cpuUsage}%`));
      } else if (cpuUsage >= thresholds.warning) {
        alerts.push(this.createAlert('cpu', cpuUsage, thresholds.warning, 'warning', `CPU usage is elevated: ${cpuUsage}%`));
      }
    }

    // Memory alerts
    if (this.config.metrics.memory.enabled) {
      const memoryUsage = metrics.memory.usage;
      const thresholds = this.config.metrics.memory.thresholds;
      
      if (memoryUsage >= thresholds.emergency) {
        alerts.push(this.createAlert('memory', memoryUsage, thresholds.emergency, 'emergency', `Memory usage is critically high: ${memoryUsage}%`));
      } else if (memoryUsage >= thresholds.critical) {
        alerts.push(this.createAlert('memory', memoryUsage, thresholds.critical, 'critical', `Memory usage is high: ${memoryUsage}%`));
      } else if (memoryUsage >= thresholds.warning) {
        alerts.push(this.createAlert('memory', memoryUsage, thresholds.warning, 'warning', `Memory usage is elevated: ${memoryUsage}%`));
      }
    }

    // Disk alerts
    if (this.config.metrics.disk.enabled) {
      const diskUsage = metrics.disk.usage;
      const thresholds = this.config.metrics.disk.thresholds;
      
      if (diskUsage >= thresholds.emergency) {
        alerts.push(this.createAlert('disk', diskUsage, thresholds.emergency, 'emergency', `Disk usage is critically high: ${diskUsage}%`));
      } else if (diskUsage >= thresholds.critical) {
        alerts.push(this.createAlert('disk', diskUsage, thresholds.critical, 'critical', `Disk usage is high: ${diskUsage}%`));
      } else if (diskUsage >= thresholds.warning) {
        alerts.push(this.createAlert('disk', diskUsage, thresholds.warning, 'warning', `Disk usage is elevated: ${diskUsage}%`));
      }
    }

    // Emit alerts
    for (const alert of alerts) {
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
  }

  private createAlert(metric: string, value: number, threshold: number, severity: Alert['severity'], message: string): Alert {
    return {
      id: `${metric}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      metric,
      value,
      threshold,
      message,
      resolved: false
    };
  }

  private cleanupOldMetrics(): void {
    const maxRetention = Math.max(
      this.config.metrics.cpu.retention || 7,
      this.config.metrics.memory.retention || 7,
      this.config.metrics.disk.retention || 7,
      this.config.metrics.network.retention || 7
    );
    
    const cutoffTime = Date.now() - (maxRetention * 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
    
    // Clean up old alerts (keep for 30 days)
    const alertCutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > alertCutoffTime);
  }

  public getStatus(): SystemStatus {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      startTime: this.startTime,
      config: this.config,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      lastMetricTime: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp : undefined
    };
  }

  public getMetrics(timeRange?: { from: number; to: number }): SystemMetrics[] {
    if (!timeRange) {
      return [...this.metrics];
    }
    
    return this.metrics.filter(m => 
      m.timestamp >= timeRange.from && m.timestamp <= timeRange.to
    );
  }

  public getAlerts(): Alert[] {
    return [...this.alerts];
  }

  public getAnalysis(): any {
    if (this.metrics.length === 0) return null;

    const recentMetrics = this.metrics.slice(-10); // Last 10 metrics
    const cpuValues = recentMetrics.map(m => m.cpu.usage);
    const memoryValues = recentMetrics.map(m => m.memory.usage);
    const diskValues = recentMetrics.map(m => m.disk.usage);

    return {
      summary: {
        overallHealth: this.calculateOverallHealth(),
        score: this.calculateHealthScore(),
        keyIssues: this.identifyKeyIssues(),
        recommendations: this.generateRecommendations()
      },
      trends: {
        cpu: this.calculateTrend(cpuValues),
        memory: this.calculateTrend(memoryValues),
        disk: this.calculateTrend(diskValues)
      },
      averages: {
        cpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
        memory: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        disk: diskValues.reduce((a, b) => a + b, 0) / diskValues.length
      }
    };
  }

  private calculateOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const recentMetrics = this.metrics.slice(-5);
    if (recentMetrics.length === 0) return 'healthy';

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.usage, 0) / recentMetrics.length;
    const avgDisk = recentMetrics.reduce((sum, m) => sum + m.disk.usage, 0) / recentMetrics.length;

    if (avgCpu >= 90 || avgMemory >= 95 || avgDisk >= 95) return 'unhealthy';
    if (avgCpu >= 80 || avgMemory >= 85 || avgDisk >= 85) return 'degraded';
    return 'healthy';
  }

  private calculateHealthScore(): number {
    const recentMetrics = this.metrics.slice(-5);
    if (recentMetrics.length === 0) return 100;

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.usage, 0) / recentMetrics.length;
    const avgDisk = recentMetrics.reduce((sum, m) => sum + m.disk.usage, 0) / recentMetrics.length;

    const cpuScore = Math.max(0, 100 - avgCpu);
    const memoryScore = Math.max(0, 100 - avgMemory);
    const diskScore = Math.max(0, 100 - avgDisk);

    return Math.round((cpuScore + memoryScore + diskScore) / 3);
  }

  private identifyKeyIssues(): string[] {
    const issues: string[] = [];
    const recentMetrics = this.metrics.slice(-5);
    
    if (recentMetrics.length === 0) return issues;

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.usage, 0) / recentMetrics.length;
    const avgDisk = recentMetrics.reduce((sum, m) => sum + m.disk.usage, 0) / recentMetrics.length;

    if (avgCpu >= 80) issues.push('High CPU usage detected');
    if (avgMemory >= 85) issues.push('High memory usage detected');
    if (avgDisk >= 85) issues.push('High disk usage detected');

    return issues;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const recentMetrics = this.metrics.slice(-5);
    
    if (recentMetrics.length === 0) return recommendations;

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.usage, 0) / recentMetrics.length;
    const avgDisk = recentMetrics.reduce((sum, m) => sum + m.disk.usage, 0) / recentMetrics.length;

    if (avgCpu >= 80) recommendations.push('Consider optimizing CPU-intensive processes');
    if (avgMemory >= 85) recommendations.push('Consider increasing memory or optimizing memory usage');
    if (avgDisk >= 85) recommendations.push('Consider cleaning up disk space or expanding storage');

    return recommendations;
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    if (Math.abs(diff) < 5) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  public updateConfig(newConfig: Partial<SystemMonitorConfig>): void {
    this.config = this.mergeDefaultConfig({ ...this.config, ...newConfig });
    this.emit('configUpdated', this.config);
  }

  public async healthCheck(): Promise<HealthStatus> {
    const recentMetrics = this.metrics.slice(-1);
    const lastMetric = recentMetrics[0];
    
    const health: HealthStatus = {
      status: 'healthy',
      components: {
        systemMonitor: this.isRunning ? 'healthy' : 'unhealthy',
        cpu: 'healthy',
        memory: 'healthy',
        disk: 'healthy',
        network: 'healthy'
      },
      metrics: {
        uptime: this.isRunning ? Date.now() - this.startTime : 0,
        metricsCollected: this.metrics.length,
        alertsGenerated: this.alerts.length,
        lastMetricTime: lastMetric?.timestamp
      },
      timestamp: Date.now()
    };

    if (lastMetric) {
      // Check component health based on recent metrics
      if (lastMetric.cpu.usage >= 90) health.components.cpu = 'unhealthy';
      else if (lastMetric.cpu.usage >= 80) health.components.cpu = 'degraded';

      if (lastMetric.memory.usage >= 95) health.components.memory = 'unhealthy';
      else if (lastMetric.memory.usage >= 85) health.components.memory = 'degraded';

      if (lastMetric.disk.usage >= 95) health.components.disk = 'unhealthy';
      else if (lastMetric.disk.usage >= 85) health.components.disk = 'degraded';

      // Determine overall health
      const componentHealths = Object.values(health.components);
      if (componentHealths.includes('unhealthy')) health.status = 'unhealthy';
      else if (componentHealths.includes('degraded')) health.status = 'degraded';
    }

    return health;
  }
}

// Export types and class
export default SystemMonitor;